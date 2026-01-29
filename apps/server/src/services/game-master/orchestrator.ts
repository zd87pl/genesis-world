import type { PlayerState, WorldChunk, NPCState, WorldEvent } from '@genesis/shared';
import { GM_TICK_INTERVAL, GM_GENERATION_LOOKAHEAD, CHUNK_SIZE } from '@genesis/shared';
import { positionToChunkId, getAdjacentChunkIds, determineBiome } from '@genesis/shared/world';
import { WorldStateManager } from '../sync/state-manager.js';
import { NPCManager } from '../npc/manager.js';
import { config } from '../../config.js';
import { AIGameMaster } from './narrative-engine.js';
import { AIDirector, type NPCDialogueContext, type NPCDialogueResponse } from './ai-director.js';

interface PlayerMemory {
  discoveries: string[];
  visitedChunks: string[];
  npcInteractions: Map<string, number>;
  lastPosition: { x: number; z: number };
  conversationHistory: Map<string, { playerText: string; npcResponse: string }[]>;
}

export class GameMasterOrchestrator {
  private worldState: WorldStateManager;
  private npcManager: NPCManager;
  private playerMemories: Map<string, PlayerMemory> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private pendingGenerations: Set<string> = new Set();

  // AI components (only initialized with API key)
  private aiGameMaster: AIGameMaster | null = null;
  private aiDirector: AIDirector | null = null;
  private useAI: boolean = false;

  constructor(worldState: WorldStateManager, npcManager: NPCManager) {
    this.worldState = worldState;
    this.npcManager = npcManager;

    // Initialize AI components if API key is available
    if (config.anthropicApiKey) {
      this.aiGameMaster = new AIGameMaster(config.anthropicApiKey);
      this.aiDirector = new AIDirector(config.anthropicApiKey);
      this.useAI = true;
      console.log('AI Game Master and Director initialized');
    } else {
      console.log('Running without AI (no API key) - using procedural generation');
    }
  }

  start(): void {
    if (this.tickInterval) return;

    console.log('Game Master started');

    this.tickInterval = setInterval(() => {
      this.tick();
    }, GM_TICK_INTERVAL);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log('Game Master stopped');
  }

  private async tick(): Promise<void> {
    const players = this.worldState.getActivePlayers();

    for (const player of players) {
      // Update player memory
      this.updatePlayerMemory(player);

      // Check world expansion needs
      await this.checkWorldExpansion(player);
    }

    // Use AI Game Master for narrative decisions when available
    if (this.useAI && this.aiGameMaster && players.length > 0) {
      try {
        const worldState = {
          players,
          npcs: this.worldState.getAllNPCs(),
          chunks: this.worldState.getAllChunks(),
          recentEvents: this.worldState.getRecentEvents(20),
        };

        const decisions = await this.aiGameMaster.tick(worldState);

        // Execute AI decisions
        for (const decision of decisions) {
          await this.executeGMDecision(decision);
        }
      } catch (error) {
        console.error('AI Game Master tick failed:', error);
      }
    }

    // Global world events (future: weather, day/night, emergent events)
    await this.processGlobalEvents();
  }

  /**
   * Execute a decision made by the AI Game Master
   */
  private async executeGMDecision(decision: any): Promise<void> {
    switch (decision.type) {
      case 'trigger_event':
        this.worldState.addEvent({
          id: `gm_event_${Date.now()}`,
          type: 'world_change',
          data: {
            gmEventType: decision.action.eventType,
            description: decision.action.description,
            area: decision.action.affectedArea,
          },
          timestamp: Date.now(),
        });
        break;

      case 'npc_action':
        const npc = this.worldState.getNPC(decision.action.npcId);
        if (npc) {
          this.worldState.updateNPCPartial(decision.action.npcId, {
            currentAction: decision.action.action,
          });
        }
        break;

      case 'reveal_secret':
        console.log(`[GM] Revealing secret: ${decision.action.secretId}`);
        // Secret reveals are handled through NPC dialogue context
        break;

      case 'advance_narrative':
        console.log(`[GM] Advancing narrative: ${decision.action.narrativeId}`);
        break;

      case 'create_tension':
        console.log(`[GM] Creating tension: ${decision.action.source}`);
        break;

      case 'provide_relief':
        console.log(`[GM] Providing relief: ${decision.action.type}`);
        break;

      default:
        console.log(`[GM] Unknown decision type: ${decision.type}`);
    }
  }

  private updatePlayerMemory(player: PlayerState): void {
    let memory = this.playerMemories.get(player.id);

    if (!memory) {
      memory = {
        discoveries: [],
        visitedChunks: [],
        npcInteractions: new Map(),
        lastPosition: { x: player.position.x, z: player.position.z },
        conversationHistory: new Map(),
      };
      this.playerMemories.set(player.id, memory);
    }

    // Track visited chunks
    const currentChunk = positionToChunkId(player.position);
    if (!memory.visitedChunks.includes(currentChunk)) {
      memory.visitedChunks.push(currentChunk);
    }

    memory.lastPosition = { x: player.position.x, z: player.position.z };
  }

  checkPlayerPosition(player: PlayerState): void {
    const currentChunk = positionToChunkId(player.position);

    // Check adjacent chunks for loading
    const adjacentChunks = getAdjacentChunkIds(currentChunk);
    adjacentChunks.push(currentChunk); // Include current chunk

    for (const chunkId of adjacentChunks) {
      const chunk = this.worldState.getChunk(chunkId);
      if (!chunk) {
        // Chunk doesn't exist, create placeholder
        this.worldState.updateChunk(chunkId, {
          status: 'loading',
          biome: determineBiome(chunkId),
        });
      }
    }
  }

  private async checkWorldExpansion(player: PlayerState): Promise<void> {
    const playerChunk = positionToChunkId(player.position);
    const memory = this.playerMemories.get(player.id);

    if (!memory) return;

    // Check chunks in lookahead radius
    const chunksToCheck = this.getChunksInRadius(playerChunk, GM_GENERATION_LOOKAHEAD);

    for (const chunkId of chunksToCheck) {
      const chunk = this.worldState.getChunk(chunkId);

      // Skip if already generated or generating
      if (chunk?.status === 'ready' || chunk?.status === 'generating') {
        continue;
      }

      // Skip if already pending
      if (this.pendingGenerations.has(chunkId)) {
        continue;
      }

      // Queue generation
      await this.queueChunkGeneration(chunkId, player);
    }
  }

  async requestChunkGeneration(chunkId: string, playerId: string): Promise<void> {
    if (this.pendingGenerations.has(chunkId)) return;

    const player = this.worldState.getPlayer(playerId);
    if (player) {
      await this.queueChunkGeneration(chunkId, player);
    }
  }

  private async queueChunkGeneration(
    chunkId: string,
    player: PlayerState
  ): Promise<void> {
    this.pendingGenerations.add(chunkId);

    // Mark as generating
    this.worldState.updateChunk(chunkId, { status: 'generating' });

    try {
      // Generate chunk content
      const chunkData = await this.generateChunkContent(chunkId, player);

      // Update chunk with generated content
      this.worldState.updateChunk(chunkId, {
        status: 'ready',
        pointsOfInterest: chunkData.pointsOfInterest,
        npcs: chunkData.npcIds,
        generatedAt: Date.now(),
      });

      // Create NPCs for this chunk
      for (const npcData of chunkData.npcs) {
        this.worldState.addNPC(npcData);
      }

      console.log(`Generated chunk ${chunkId} with ${chunkData.pointsOfInterest.length} POIs`);
    } catch (error) {
      console.error(`Failed to generate chunk ${chunkId}:`, error);
      this.worldState.updateChunk(chunkId, { status: 'error' });
    } finally {
      this.pendingGenerations.delete(chunkId);
    }
  }

  private async generateChunkContent(
    chunkId: string,
    player: PlayerState
  ): Promise<{
    pointsOfInterest: WorldChunk['pointsOfInterest'];
    npcs: NPCState[];
    npcIds: string[];
  }> {
    const [cx, cz] = chunkId.split(',').map(Number);
    const biome = determineBiome(chunkId);

    // If no API key, use procedural generation
    if (!config.anthropicApiKey) {
      return this.generateProceduralContent(chunkId, biome);
    }

    try {
      const context = await this.buildGenerationContext(chunkId, player);
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: GAME_MASTER_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Generate content for world chunk ${chunkId} (biome: ${biome}).

Context:
${context}

Respond with JSON only:
{
  "pointsOfInterest": [
    {
      "type": "building|landmark|mystery|resource",
      "name": "Name",
      "description": "Description",
      "relativeX": 0-100,
      "relativeZ": 0-100
    }
  ],
  "npcs": [
    {
      "name": "Name",
      "archetype": "merchant|guard|wanderer|quest_giver",
      "relativeX": 0-100,
      "relativeZ": 0-100
    }
  ]
}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const generated = JSON.parse(jsonMatch[0]);

      // Convert relative positions to world positions
      const baseX = cx * CHUNK_SIZE;
      const baseZ = cz * CHUNK_SIZE;

      const pointsOfInterest = (generated.pointsOfInterest || []).map(
        (poi: any, idx: number) => ({
          id: `poi_${chunkId}_${idx}`,
          type: poi.type,
          name: poi.name,
          description: poi.description,
          position: {
            x: baseX + poi.relativeX,
            y: 0,
            z: baseZ + poi.relativeZ,
          },
          discovered: false,
        })
      );

      const npcs: NPCState[] = (generated.npcs || []).map((npc: any, idx: number) => ({
        id: `npc_${chunkId}_${idx}`,
        name: npc.name,
        position: {
          x: baseX + npc.relativeX,
          y: 0,
          z: baseZ + npc.relativeZ,
        },
        rotation: Math.random() * Math.PI * 2,
        currentAction: 'idle' as const,
        mood: 'neutral' as const,
        archetype: npc.archetype,
      }));

      return {
        pointsOfInterest,
        npcs,
        npcIds: npcs.map((n) => n.id),
      };
    } catch (error) {
      console.error('AI generation failed, using procedural:', error);
      return this.generateProceduralContent(chunkId, biome);
    }
  }

  private generateProceduralContent(
    chunkId: string,
    biome: string
  ): {
    pointsOfInterest: WorldChunk['pointsOfInterest'];
    npcs: NPCState[];
    npcIds: string[];
  } {
    const [cx, cz] = chunkId.split(',').map(Number);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    // Use deterministic seed based on chunk ID
    const seed = this.hashString(chunkId);
    const random = this.seededRandom(seed);

    const pointsOfInterest: WorldChunk['pointsOfInterest'] = [];
    const npcs: NPCState[] = [];

    // Generate 1-3 POIs
    const poiCount = 1 + Math.floor(random() * 3);
    const poiTypes = ['landmark', 'building', 'resource', 'mystery'];
    const biomeNames: Record<string, string[]> = {
      forest: ['Ancient Oak', 'Mushroom Ring', 'Hunter Lodge', 'Hidden Spring'],
      plains: ['Standing Stone', 'Old Farm', 'Windmill', 'Traveler Camp'],
      urban: ['Ruined Tower', 'Market Square', 'Old Library', 'Statue'],
      desert: ['Oasis', 'Sand Temple', 'Trader Tent', 'Bone Pile'],
      coastal: ['Lighthouse', 'Shipwreck', 'Fisherman Hut', 'Tide Pool'],
      mystical: ['Portal Stone', 'Crystal Cave', 'Fairy Ring', 'Arcane Altar'],
    };

    const names = biomeNames[biome] || biomeNames.plains;

    for (let i = 0; i < poiCount; i++) {
      pointsOfInterest.push({
        id: `poi_${chunkId}_${i}`,
        type: poiTypes[Math.floor(random() * poiTypes.length)] as any,
        name: names[Math.floor(random() * names.length)],
        description: `A mysterious ${biome} location.`,
        position: {
          x: baseX + random() * CHUNK_SIZE,
          y: 0,
          z: baseZ + random() * CHUNK_SIZE,
        },
        discovered: false,
      });
    }

    // 50% chance of an NPC
    if (random() > 0.5) {
      const archetypes: NPCState['archetype'][] = [
        'merchant',
        'guard',
        'wanderer',
        'quest_giver',
      ];
      const npcNames = ['Traveler', 'Merchant', 'Scout', 'Hermit', 'Wanderer'];

      const npc: NPCState = {
        id: `npc_${chunkId}_0`,
        name: npcNames[Math.floor(random() * npcNames.length)],
        position: {
          x: baseX + random() * CHUNK_SIZE,
          y: 0,
          z: baseZ + random() * CHUNK_SIZE,
        },
        rotation: random() * Math.PI * 2,
        currentAction: 'idle',
        mood: 'neutral',
        archetype: archetypes[Math.floor(random() * archetypes.length)],
      };

      npcs.push(npc);
    }

    return {
      pointsOfInterest,
      npcs,
      npcIds: npcs.map((n) => n.id),
    };
  }

  private async buildGenerationContext(
    chunkId: string,
    player: PlayerState
  ): Promise<string> {
    const [x, z] = chunkId.split(',').map(Number);
    const biome = determineBiome(chunkId);
    const memory = this.playerMemories.get(player.id);

    const adjacentChunks = getAdjacentChunkIds(chunkId)
      .map((id) => this.worldState.getChunk(id))
      .filter(Boolean);

    const recentEvents = this.worldState.getEventsForPlayer(player.id, 10);

    return `
World Position: Chunk (${x}, ${z})
Biome: ${biome}
Distance from spawn: ${Math.sqrt(x * x + z * z).toFixed(1)} chunks

Adjacent Areas:
${adjacentChunks.map((c) => `- ${c!.id} (${c!.biome}): ${c!.pointsOfInterest.map((p) => p.name).join(', ') || 'unexplored'}`).join('\n')}

Player "${player.name}" Context:
- Visited chunks: ${memory?.visitedChunks.length || 0}
- Recent discoveries: ${memory?.discoveries.slice(-5).join(', ') || 'None'}

Recent Events:
${recentEvents.map((e) => `- ${e.type}: ${JSON.stringify(e.data)}`).join('\n')}
`;
  }

  private async processGlobalEvents(): Promise<void> {
    // Future: weather changes, day/night cycle, emergent events
    // For PoC, this is a placeholder
  }

  /**
   * AI-driven NPC dialogue - the heart of dynamic storytelling
   */
  async generateNPCDialogue(
    playerId: string,
    npcId: string,
    playerMessage: string
  ): Promise<NPCDialogueResponse> {
    const npc = this.worldState.getNPC(npcId);
    const player = this.worldState.getPlayer(playerId);

    if (!npc || !player) {
      return {
        text: '...',
        emotion: 'neutral',
        action: null,
      };
    }

    // Get player memory for conversation history
    let memory = this.playerMemories.get(playerId);
    if (!memory) {
      memory = {
        discoveries: [],
        visitedChunks: [],
        npcInteractions: new Map(),
        lastPosition: { x: player.position.x, z: player.position.z },
        conversationHistory: new Map(),
      };
      this.playerMemories.set(playerId, memory);
    }

    // Get conversation history for this NPC
    let history = memory.conversationHistory.get(npcId) || [];

    // Use AI Director when available
    if (this.useAI && this.aiDirector && this.aiGameMaster) {
      try {
        // Get narrative context from Game Master
        const narrativeContext = this.aiGameMaster.getNPCContext(npcId, playerId);

        // Build dialogue context
        const dialogueContext: NPCDialogueContext = {
          relationship: narrativeContext.relationship,
          previousInteractions: narrativeContext.previousInteractions.map((i) => ({
            topics: i.topicsDiscussed,
            timestamp: i.timestamp,
          })),
          secrets: narrativeContext.secretsToHint,
          activeNarratives: narrativeContext.relevantNarratives,
          conversationHistory: history,
        };

        // Generate AI response
        const response = await this.aiDirector.generateNPCDialogue(
          npc,
          playerMessage,
          dialogueContext
        );

        // Update conversation history
        history.push({
          playerText: playerMessage,
          npcResponse: response.text,
        });
        memory.conversationHistory.set(npcId, history.slice(-10)); // Keep last 10 exchanges

        // Track interaction for narrative purposes
        const interactions = memory.npcInteractions.get(npcId) || 0;
        memory.npcInteractions.set(npcId, interactions + 1);

        return response;
      } catch (error) {
        console.error('AI dialogue generation failed:', error);
        // Fall through to fallback
      }
    }

    // Fallback: Use simple pattern-based responses
    return this.generateFallbackDialogue(npc, playerMessage);
  }

  /**
   * Fallback dialogue when AI is not available
   */
  private generateFallbackDialogue(npc: NPCState, message: string): NPCDialogueResponse {
    const lower = message.toLowerCase();

    // Simple keyword matching
    if (lower.includes('hello') || lower.includes('hi')) {
      return {
        text: `Greetings, traveler. I am ${npc.name}.`,
        emotion: 'friendly',
        action: null,
      };
    }

    if (lower.includes('bye') || lower.includes('farewell')) {
      return {
        text: 'Safe travels. May we meet again.',
        emotion: 'neutral',
        action: null,
      };
    }

    if (lower.includes('help') || lower.includes('what')) {
      return {
        text: 'Explore the land. Speak to those you meet. The world reveals its secrets to the curious.',
        emotion: 'thoughtful',
        action: null,
      };
    }

    // Default response based on archetype
    const archetypeResponses: Record<string, string> = {
      sage: 'The answers you seek lie within, traveler. Look deeper.',
      wanderer: "There's always another road to travel. That's what makes it interesting!",
      guard: 'Stay vigilant. These lands are not always safe.',
      merchant: 'Looking for something specific? I might have what you need.',
      quest_giver: 'The world needs heroes. Perhaps you could help?',
      mysterious: '...some questions have no answers. Not yet.',
    };

    return {
      text: archetypeResponses[npc.archetype || 'wanderer'] || 'Hmm, interesting.',
      emotion: 'neutral',
      action: null,
    };
  }

  /**
   * Generate world event narration
   */
  async narrateEvent(event: WorldEvent): Promise<string> {
    if (this.useAI && this.aiDirector) {
      try {
        return await this.aiDirector.narrateWorldEvent({
          type: event.type,
          description: JSON.stringify(event.data),
          context: 'A significant event occurs in the world.',
          location: (event.data?.area as string) || 'the land',
        });
      } catch (error) {
        console.error('Event narration failed:', error);
      }
    }

    // Fallback narration
    return `Something stirs in the world...`;
  }

  /**
   * Get AI status for debugging/display
   */
  getAIStatus(): { enabled: boolean; gameMaster: boolean; director: boolean } {
    return {
      enabled: this.useAI,
      gameMaster: this.aiGameMaster !== null,
      director: this.aiDirector !== null,
    };
  }

  private getChunksInRadius(centerChunkId: string, radius: number): string[] {
    const [cx, cz] = centerChunkId.split(',').map(Number);
    const chunks: string[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        chunks.push(`${cx + dx},${cz + dz}`);
      }
    }

    return chunks;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }
}

const GAME_MASTER_SYSTEM_PROMPT = `You are the Game Master of Genesis World, an AI-orchestrated virtual reality experience. Your role is to create a living, breathing world that responds to player actions.

CORE PRINCIPLES:
1. COHERENCE - New areas must fit established world logic
2. PLAYER AGENCY - Create situations with multiple valid paths
3. EMERGENT NARRATIVE - Plant seeds, let players choose which to explore
4. THE WORLD LIVES - NPCs have lives beyond player interaction

GENERATION GUIDELINES:
- Include 1-3 points of interest per chunk
- At least one point should hint at broader mysteries
- NPCs should have a purpose beyond waiting for players
- Environmental storytelling through ruins, artifacts, evidence

Respond with valid JSON only. Be concise but evocative.`;
