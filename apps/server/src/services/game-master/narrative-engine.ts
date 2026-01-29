import Anthropic from '@anthropic-ai/sdk';
import type {
  PlayerState,
  NPCState,
  WorldChunk,
  WorldEvent,
  PointOfInterest,
} from '@genesis/shared';

/**
 * World Memory - The GM's persistent understanding of everything that matters
 */
interface WorldMemory {
  // Core narrative state
  activeNarratives: NarrativeThread[];
  resolvedNarratives: NarrativeThread[];
  worldSecrets: WorldSecret[];

  // Entity memories
  npcMemories: Map<string, NPCMemory>;
  playerProfiles: Map<string, PlayerProfile>;

  // World state
  factions: Faction[];
  globalEvents: GlobalEvent[];
  discoveredLore: string[];

  // Meta tracking
  totalPlayTime: number;
  sessionCount: number;
  lastMajorEvent: number;
}

interface NarrativeThread {
  id: string;
  name: string;
  type: 'mystery' | 'conflict' | 'discovery' | 'relationship' | 'transformation';
  status: 'seeded' | 'active' | 'climax' | 'resolved';
  urgency: number; // 0-1, how soon this needs attention
  involvedNPCs: string[];
  involvedPlayers: string[];
  involvedLocations: string[];
  seeds: string[]; // Clues/hints planted
  possibleResolutions: string[];
  playerProgress: number; // 0-1
  createdAt: number;
  lastUpdated: number;
}

interface WorldSecret {
  id: string;
  content: string;
  revealConditions: string[];
  partialReveals: { condition: string; hint: string }[];
  discovered: boolean;
  discoveredBy?: string;
}

interface NPCMemory {
  npcId: string;
  significantInteractions: NPCInteraction[];
  relationshipWithPlayers: Map<string, number>; // -100 to 100
  currentGoals: string[];
  secrets: string[];
  lastSeen: number;
  emotionalState: string;
}

interface NPCInteraction {
  playerId: string;
  timestamp: number;
  summary: string;
  emotionalImpact: number;
  topicsDiscussed: string[];
  promisesMade: string[];
  promisesBroken: string[];
}

interface PlayerProfile {
  playerId: string;
  playerName: string;
  playstyle: 'explorer' | 'socializer' | 'achiever' | 'storyteller' | 'unknown';
  interests: string[]; // What they engage with most
  avoidances: string[]; // What they seem to dislike
  discoveredSecrets: string[];
  completedNarratives: string[];
  activeQuests: string[];
  significantChoices: PlayerChoice[];
  sessionHistory: SessionSummary[];
}

interface PlayerChoice {
  timestamp: number;
  situation: string;
  choice: string;
  consequences: string[];
  narrativeImpact: string;
}

interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime: number;
  majorEvents: string[];
  emotionalArc: string;
  cliffhanger?: string;
}

interface Faction {
  id: string;
  name: string;
  goals: string[];
  resources: string[];
  relationships: Map<string, number>; // Other faction IDs → relationship
  territoryChunks: string[];
  keyNPCs: string[];
}

interface GlobalEvent {
  id: string;
  name: string;
  type: 'weather' | 'political' | 'supernatural' | 'economic' | 'catastrophe';
  description: string;
  startTime: number;
  duration: number;
  affectedChunks: string[];
  consequences: string[];
}

/**
 * GM Decision Actions - Type-safe action payloads
 */
interface TriggerEventAction {
  eventType: string;
  description: string;
  affectedArea: string;
}

interface NPCActionPayload {
  npcId: string;
  action: 'idle' | 'walking' | 'talking' | 'working';
}

interface RevealSecretAction {
  secretId: string;
  revealedTo: string[];
}

interface AdvanceNarrativeAction {
  narrativeId: string;
  newPhase: string;
}

interface CreateTensionAction {
  source: string;
  intensity: number;
}

interface ProvideReliefAction {
  type: string;
  reward?: string;
  emotional_beat?: string;
}

interface GenerateContentAction {
  chunkId: string;
  theme: string;
}

/**
 * GM Decision - What the AI decides to do
 */
export interface GMDecision {
  type:
    | 'generate_content'
    | 'trigger_event'
    | 'npc_action'
    | 'reveal_secret'
    | 'advance_narrative'
    | 'create_tension'
    | 'provide_relief';
  priority: number;
  reasoning: string;
  action:
    | TriggerEventAction
    | NPCActionPayload
    | RevealSecretAction
    | AdvanceNarrativeAction
    | CreateTensionAction
    | ProvideReliefAction
    | GenerateContentAction;
}

/**
 * The AI Game Master - Narrative Intelligence System
 */
export class AIGameMaster {
  private anthropic: Anthropic;
  private memory: WorldMemory;
  private pendingDecisions: GMDecision[] = [];

  // Tuning
  private readonly NARRATIVE_DENSITY = 0.7; // How much is happening at once
  private readonly MYSTERY_PREFERENCE = 0.8; // Bias toward mysterious content
  private readonly PLAYER_AGENCY_WEIGHT = 0.9; // How much player choices matter
  private readonly TENSION_CYCLE_MINUTES = 15; // Time between tension peaks

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.memory = this.initializeMemory();
  }

  private initializeMemory(): WorldMemory {
    return {
      activeNarratives: [],
      resolvedNarratives: [],
      worldSecrets: this.createInitialSecrets(),
      npcMemories: new Map(),
      playerProfiles: new Map(),
      factions: this.createInitialFactions(),
      globalEvents: [],
      discoveredLore: [],
      totalPlayTime: 0,
      sessionCount: 0,
      lastMajorEvent: 0,
    };
  }

  private createInitialSecrets(): WorldSecret[] {
    return [
      {
        id: 'secret_crystal_origin',
        content:
          'The Genesis Crystal is a fragment of a shattered god, containing the last dreams of a dying deity.',
        revealConditions: [
          'player_touches_crystal',
          'sage_trusts_player',
          'all_runes_discovered',
        ],
        partialReveals: [
          {
            condition: 'near_crystal_5min',
            hint: 'The crystal seems to pulse with something like... breathing.',
          },
          {
            condition: 'sage_conversation_3',
            hint: 'Elara mentions "the sleeper" but refuses to elaborate.',
          },
        ],
        discovered: false,
      },
      {
        id: 'secret_world_nature',
        content:
          'This realm exists in the collective unconscious of all who dream. Visitors literally shape reality with their expectations.',
        revealConditions: ['explore_10_chunks', 'notice_world_responding'],
        partialReveals: [
          {
            condition: 'explore_5_chunks',
            hint: 'The world always seems to have exactly what you were looking for...',
          },
        ],
        discovered: false,
      },
      {
        id: 'secret_wanderer_past',
        content:
          "Finn was once a powerful architect of this realm, who chose to forget his powers after a catastrophe he caused.",
        revealConditions: ['finn_trust_max', 'find_finns_monument'],
        partialReveals: [
          {
            condition: 'finn_conversation_5',
            hint: "Finn sometimes speaks of places he shouldn't know about.",
          },
        ],
        discovered: false,
      },
    ];
  }

  private createInitialFactions(): Faction[] {
    return [
      {
        id: 'keepers',
        name: 'The Keepers of the Threshold',
        goals: ['Protect the Genesis Crystal', 'Guide worthy travelers', 'Prevent the Awakening'],
        resources: ['Ancient knowledge', 'Crystal resonance', 'Memory walking'],
        relationships: new Map([
          ['wanderers', 30],
          ['forgotten', -80],
        ]),
        territoryChunks: ['0,0', '0,1', '1,0', '1,1'],
        keyNPCs: ['npc_sage_elara'],
      },
      {
        id: 'wanderers',
        name: 'The Eternal Wanderers',
        goals: ['Explore all paths', 'Collect stories', 'Find the way home'],
        resources: ['Road knowledge', 'Trade goods', 'Survival skills'],
        relationships: new Map([
          ['keepers', 30],
          ['forgotten', -20],
        ]),
        territoryChunks: [],
        keyNPCs: ['npc_wanderer_finn'],
      },
      {
        id: 'forgotten',
        name: 'The Forgotten',
        goals: ['Consume memories', 'Expand the void', 'Wake the sleeper'],
        resources: ['Shadow walking', 'Memory theft', 'Dream corruption'],
        relationships: new Map([
          ['keepers', -80],
          ['wanderers', -20],
        ]),
        territoryChunks: [],
        keyNPCs: [],
      },
    ];
  }

  /**
   * Main GM tick - called every few seconds
   */
  async tick(worldState: {
    players: PlayerState[];
    npcs: NPCState[];
    chunks: Map<string, WorldChunk>;
    recentEvents: WorldEvent[];
  }): Promise<GMDecision[]> {
    // Update player profiles
    for (const player of worldState.players) {
      this.updatePlayerProfile(player, worldState);
    }

    // Check narrative state
    const narrativeNeeds = this.assessNarrativeNeeds(worldState);

    // Build context for AI
    const context = this.buildGMContext(worldState, narrativeNeeds);

    // Get AI decisions
    const decisions = await this.getAIDecisions(context);

    // Queue decisions by priority
    this.pendingDecisions = [...this.pendingDecisions, ...decisions].sort(
      (a, b) => b.priority - a.priority
    );

    // Execute top decisions
    const executed = this.pendingDecisions.splice(0, 3);
    return executed;
  }

  private updatePlayerProfile(player: PlayerState, worldState: any): void {
    let profile = this.memory.playerProfiles.get(player.id);

    if (!profile) {
      profile = {
        playerId: player.id,
        playerName: player.name,
        playstyle: 'unknown',
        interests: [],
        avoidances: [],
        discoveredSecrets: [],
        completedNarratives: [],
        activeQuests: [],
        significantChoices: [],
        sessionHistory: [],
      };
      this.memory.playerProfiles.set(player.id, profile);
    }

    // Infer playstyle from behavior
    // (In production, track actual metrics)
  }

  private assessNarrativeNeeds(worldState: any): NarrativeNeeds {
    const now = Date.now();
    const timeSinceLastEvent = now - this.memory.lastMajorEvent;
    const activeNarrativeCount = this.memory.activeNarratives.filter(
      (n) => n.status === 'active'
    ).length;

    return {
      needsNewThread: activeNarrativeCount < 2,
      needsTension: timeSinceLastEvent > this.TENSION_CYCLE_MINUTES * 60 * 1000,
      needsRelief:
        this.memory.activeNarratives.some((n) => n.urgency > 0.8) &&
        activeNarrativeCount > 3,
      needsResolution: this.memory.activeNarratives.some(
        (n) => n.playerProgress > 0.9
      ),
      playerEngagement: this.assessPlayerEngagement(worldState.players),
    };
  }

  private assessPlayerEngagement(players: PlayerState[]): number {
    // Simplified - in production, track velocity, interaction rate, etc.
    return players.length > 0 ? 0.7 : 0;
  }

  private buildGMContext(worldState: any, needs: NarrativeNeeds): string {
    const activeNarratives = this.memory.activeNarratives
      .map((n) => `- ${n.name} (${n.type}, ${n.status}): Progress ${Math.round(n.playerProgress * 100)}%`)
      .join('\n');

    const playerSummaries = Array.from(this.memory.playerProfiles.values())
      .map((p) => `- ${p.playerName}: ${p.playstyle} playstyle, interests: ${p.interests.join(', ') || 'unknown'}`)
      .join('\n');

    const recentEvents = worldState.recentEvents
      .slice(-10)
      .map((e: WorldEvent) => `- ${e.type}: ${JSON.stringify(e.data)}`)
      .join('\n');

    return `
# WORLD STATE

## Active Players
${playerSummaries || 'No player profiles yet'}

## Active Narrative Threads
${activeNarratives || 'No active narratives'}

## Recent Events
${recentEvents || 'No recent events'}

## Narrative Needs Assessment
- Needs new story thread: ${needs.needsNewThread}
- Needs tension/conflict: ${needs.needsTension}
- Needs relief/breather: ${needs.needsRelief}
- Needs resolution: ${needs.needsResolution}
- Player engagement level: ${needs.playerEngagement}

## World Secrets (GM Eyes Only)
${this.memory.worldSecrets.filter((s) => !s.discovered).map((s) => `- ${s.id}: Conditions met: ${s.revealConditions.join(', ')}`).join('\n')}

## Factions
${this.memory.factions.map((f) => `- ${f.name}: ${f.goals[0]}`).join('\n')}
`;
  }

  private async getAIDecisions(context: string): Promise<GMDecision[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: GM_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${context}

Based on the current world state and narrative needs, decide what should happen next.

Respond with a JSON array of 1-3 decisions:
[
  {
    "type": "generate_content|trigger_event|npc_action|reveal_secret|advance_narrative|create_tension|provide_relief",
    "priority": 0.0-1.0,
    "reasoning": "Why this decision serves the narrative",
    "action": { /* type-specific action data */ }
  }
]

For generate_content, action should include: { "chunkId": "x,y", "theme": "...", "elements": [...] }
For trigger_event, action should include: { "eventType": "...", "description": "...", "affectedArea": "..." }
For npc_action, action should include: { "npcId": "...", "action": "...", "dialogue": "..." }
For reveal_secret, action should include: { "secretId": "...", "revealType": "full|partial", "method": "..." }
For advance_narrative, action should include: { "narrativeId": "...", "advancement": "...", "newState": "..." }
For create_tension, action should include: { "source": "...", "stakes": "...", "timeframe": "..." }
For provide_relief, action should include: { "type": "...", "reward": "...", "emotional_beat": "..." }`,
        },
      ],
    });

    try {
      if (!response.content || response.content.length === 0) return [];
      const content = response.content[0];
      if (content.type !== 'text') return [];

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]) as GMDecision[];
    } catch (error) {
      console.error('Failed to parse GM decisions:', error);
      return [];
    }
  }

  /**
   * Generate world chunk with narrative awareness
   */
  async generateChunk(
    chunkId: string,
    adjacentChunks: WorldChunk[],
    nearestPlayer: PlayerState
  ): Promise<ChunkGeneration> {
    const playerProfile = this.memory.playerProfiles.get(nearestPlayer.id);
    const activeNarratives = this.memory.activeNarratives.filter(
      (n) => n.status === 'active' || n.status === 'seeded'
    );

    const context = `
# CHUNK GENERATION REQUEST

Chunk ID: ${chunkId}
Nearest Player: ${nearestPlayer.name}
Player Profile: ${playerProfile ? `${playerProfile.playstyle} playstyle, interests: ${playerProfile.interests.join(', ')}` : 'Unknown'}

Adjacent Chunks:
${adjacentChunks.map((c) => `- ${c.id}: ${c.biome}, POIs: ${c.pointsOfInterest.map((p) => p.name).join(', ')}`).join('\n')}

Active Narratives That Could Connect:
${activeNarratives.map((n) => `- ${n.name}: ${n.type}, needs: ${n.possibleResolutions[0]}`).join('\n')}

World Secrets That Could Be Hinted:
${this.memory.worldSecrets
  .filter((s) => !s.discovered)
  .map((s) => `- ${s.id}: partial reveals available`)
  .join('\n')}
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: CHUNK_GENERATION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${context}

Generate this chunk with narrative purpose. Every element should either:
1. Advance an existing narrative thread
2. Seed a new mystery
3. Reward exploration with lore
4. Create atmospheric world-building

Respond with JSON:
{
  "biome": "forest|desert|urban|mystical|coastal|corrupted",
  "atmosphericDescription": "Evocative description for generation",
  "pointsOfInterest": [
    {
      "type": "building|landmark|mystery|resource|narrative",
      "name": "Name",
      "description": "Description",
      "narrativePurpose": "What story role this serves",
      "interactionPossibilities": ["what players can do here"],
      "secrets": ["hidden elements"],
      "relativeX": 0-100,
      "relativeZ": 0-100
    }
  ],
  "npcs": [
    {
      "name": "Name",
      "archetype": "merchant|guard|wanderer|quest_giver|mysterious",
      "narrativeRole": "Their purpose in the story",
      "secrets": ["what they know"],
      "relativeX": 0-100,
      "relativeZ": 0-100
    }
  ],
  "ambientElements": ["environmental storytelling details"],
  "narrativeSeeds": ["future plot hooks planted here"]
}`,
        },
      ],
    });

    try {
      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from AI');
      }
      const content = response.content[0];
      if (content.type !== 'text') throw new Error('Unexpected response type');

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      return JSON.parse(jsonMatch[0]) as ChunkGeneration;
    } catch (error) {
      console.error('Chunk generation failed:', error);
      return this.fallbackChunkGeneration(chunkId);
    }
  }

  private fallbackChunkGeneration(chunkId: string): ChunkGeneration {
    return {
      biome: 'forest',
      atmosphericDescription: 'A quiet stretch of woodland.',
      pointsOfInterest: [],
      npcs: [],
      ambientElements: ['Rustling leaves', 'Distant bird calls'],
      narrativeSeeds: [],
    };
  }

  /**
   * Process player interaction and update narrative state
   */
  async processPlayerAction(
    playerId: string,
    action: PlayerAction
  ): Promise<NarrativeResponse> {
    const player = this.memory.playerProfiles.get(playerId);
    if (!player) return { acknowledged: false };

    // Record significant actions
    if (action.significance > 0.5) {
      player.significantChoices.push({
        timestamp: Date.now(),
        situation: action.context,
        choice: action.description,
        consequences: [],
        narrativeImpact: '',
      });
    }

    // Check for secret reveals
    const revealedSecrets = this.checkSecretReveals(playerId, action);

    // Check narrative advancement
    const narrativeUpdates = this.checkNarrativeAdvancement(playerId, action);

    // Update NPC memories if relevant
    if (action.involvedNPCId) {
      this.updateNPCMemory(action.involvedNPCId, playerId, action);
    }

    return {
      acknowledged: true,
      revealedSecrets,
      narrativeUpdates,
      worldResponse: await this.generateWorldResponse(action),
    };
  }

  private checkSecretReveals(playerId: string, action: PlayerAction): string[] {
    const revealed: string[] = [];

    for (const secret of this.memory.worldSecrets) {
      if (secret.discovered) continue;

      // Check partial reveals
      for (const partial of secret.partialReveals) {
        if (this.conditionMet(partial.condition, playerId, action)) {
          revealed.push(partial.hint);
        }
      }

      // Check full reveal
      if (secret.revealConditions.every((c) => this.conditionMet(c, playerId, action))) {
        secret.discovered = true;
        secret.discoveredBy = playerId;
        revealed.push(secret.content);
      }
    }

    return revealed;
  }

  private conditionMet(condition: string, playerId: string, action: PlayerAction): boolean {
    // Simplified condition checking - in production, this would be more sophisticated
    const player = this.memory.playerProfiles.get(playerId);
    if (!player) return false;

    switch (condition) {
      case 'player_touches_crystal':
        return action.type === 'interact' && action.target === 'genesis_crystal';
      case 'sage_trusts_player':
        return (this.memory.npcMemories.get('npc_sage_elara')?.relationshipWithPlayers.get(playerId) ?? 0) > 70;
      case 'finn_trust_max':
        return (this.memory.npcMemories.get('npc_wanderer_finn')?.relationshipWithPlayers.get(playerId) ?? 0) > 90;
      default:
        return false;
    }
  }

  private checkNarrativeAdvancement(playerId: string, action: PlayerAction): NarrativeUpdate[] {
    const updates: NarrativeUpdate[] = [];

    for (const narrative of this.memory.activeNarratives) {
      if (!narrative.involvedPlayers.includes(playerId)) continue;

      // Check if action advances this narrative
      // (Simplified - in production, use AI to evaluate)
      if (action.narrativeRelevance?.includes(narrative.id)) {
        narrative.playerProgress = Math.min(1, narrative.playerProgress + 0.1);
        narrative.lastUpdated = Date.now();

        if (narrative.playerProgress >= 1) {
          narrative.status = 'resolved';
          this.memory.resolvedNarratives.push(narrative);
        } else if (narrative.playerProgress >= 0.7) {
          narrative.status = 'climax';
        }

        updates.push({
          narrativeId: narrative.id,
          newProgress: narrative.playerProgress,
          newStatus: narrative.status,
        });
      }
    }

    return updates;
  }

  private updateNPCMemory(npcId: string, playerId: string, action: PlayerAction): void {
    let memory = this.memory.npcMemories.get(npcId);
    if (!memory) {
      memory = {
        npcId,
        significantInteractions: [],
        relationshipWithPlayers: new Map(),
        currentGoals: [],
        secrets: [],
        lastSeen: Date.now(),
        emotionalState: 'neutral',
      };
      this.memory.npcMemories.set(npcId, memory);
    }

    // Record interaction
    memory.significantInteractions.push({
      playerId,
      timestamp: Date.now(),
      summary: action.description,
      emotionalImpact: action.emotionalValence || 0,
      topicsDiscussed: action.topics || [],
      promisesMade: [],
      promisesBroken: [],
    });

    // Update relationship
    const currentRelation = memory.relationshipWithPlayers.get(playerId) || 0;
    const change = (action.emotionalValence || 0) * 10;
    memory.relationshipWithPlayers.set(
      playerId,
      Math.max(-100, Math.min(100, currentRelation + change))
    );

    memory.lastSeen = Date.now();
  }

  private async generateWorldResponse(action: PlayerAction): Promise<string | undefined> {
    // For significant actions, generate a world response
    if (action.significance < 0.7) return undefined;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: 'You are the voice of a mystical world responding to player actions. Be brief, evocative, and mysterious.',
      messages: [
        {
          role: 'user',
          content: `The player ${action.description}. Generate a brief atmospheric response from the world itself (not an NPC). One sentence, mysterious and evocative.`,
        },
      ],
    });

    if (!response.content || response.content.length === 0) {
      return undefined;
    }
    const content = response.content[0];
    return content.type === 'text' ? content.text : undefined;
  }

  /**
   * Get current narrative context for NPC conversations
   */
  getNPCContext(npcId: string, playerId: string): NPCConversationContext {
    const npcMemory = this.memory.npcMemories.get(npcId);
    const playerProfile = this.memory.playerProfiles.get(playerId);

    const relevantNarratives = this.memory.activeNarratives.filter(
      (n) => n.involvedNPCs.includes(npcId)
    );

    const relevantSecrets = this.memory.worldSecrets.filter(
      (s) => !s.discovered && s.revealConditions.some((c) => c.includes(npcId))
    );

    return {
      relationship: npcMemory?.relationshipWithPlayers.get(playerId) || 0,
      previousInteractions: npcMemory?.significantInteractions.filter(
        (i) => i.playerId === playerId
      ) || [],
      npcSecrets: npcMemory?.secrets || [],
      relevantNarratives: relevantNarratives.map((n) => ({
        name: n.name,
        playerProgress: n.playerProgress,
        hints: n.seeds,
      })),
      secretsToHint: relevantSecrets.flatMap((s) =>
        s.partialReveals.map((p) => p.hint)
      ),
      playerInterests: playerProfile?.interests || [],
    };
  }

  /**
   * Serialize memory for persistence
   */
  serializeMemory(): string {
    const serializable = {
      ...this.memory,
      npcMemories: Object.fromEntries(this.memory.npcMemories),
      playerProfiles: Object.fromEntries(this.memory.playerProfiles),
      factions: this.memory.factions.map((f) => ({
        ...f,
        relationships: Object.fromEntries(f.relationships),
      })),
    };
    return JSON.stringify(serializable);
  }

  /**
   * Restore memory from persistence
   */
  deserializeMemory(data: string): void {
    try {
      const parsed = JSON.parse(data);

      // Validate required fields exist
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid memory data: expected object');
      }

      this.memory = {
        ...parsed,
        npcMemories: new Map(
          Object.entries(parsed.npcMemories || {})
        ),
        playerProfiles: new Map(
          Object.entries(parsed.playerProfiles || {})
        ),
        factions: (parsed.factions || []).map((f: any) => ({
          ...f,
          relationships: new Map(Object.entries(f.relationships || {})),
        })),
      };
    } catch (error) {
      console.error('Failed to deserialize world memory:', error);
      // Keep existing memory on failure rather than corrupting state
    }
  }
}

// Types
interface NarrativeNeeds {
  needsNewThread: boolean;
  needsTension: boolean;
  needsRelief: boolean;
  needsResolution: boolean;
  playerEngagement: number;
}

interface ChunkGeneration {
  biome: string;
  atmosphericDescription: string;
  pointsOfInterest: any[];
  npcs: any[];
  ambientElements: string[];
  narrativeSeeds: string[];
}

interface PlayerAction {
  type: string;
  target?: string;
  description: string;
  context: string;
  significance: number;
  emotionalValence?: number;
  topics?: string[];
  involvedNPCId?: string;
  narrativeRelevance?: string[];
}

interface NarrativeResponse {
  acknowledged: boolean;
  revealedSecrets?: string[];
  narrativeUpdates?: NarrativeUpdate[];
  worldResponse?: string;
}

interface NarrativeUpdate {
  narrativeId: string;
  newProgress: number;
  newStatus: string;
}

interface NPCConversationContext {
  relationship: number;
  previousInteractions: NPCInteraction[];
  npcSecrets: string[];
  relevantNarratives: { name: string; playerProgress: number; hints: string[] }[];
  secretsToHint: string[];
  playerInterests: string[];
}

// System prompts
const GM_SYSTEM_PROMPT = `You are the Game Master of Genesis World - a narrative intelligence that orchestrates an emergent story.

Your responsibilities:
1. MAINTAIN COHERENCE - Everything connects. Random content destroys immersion.
2. CREATE TENSION CYCLES - Build up, release, build up. Never flat.
3. REWARD CURIOSITY - Players who explore should find meaningful things.
4. PROTECT PLAYER AGENCY - Guide, don't force. Suggest, don't demand.
5. PLANT SEEDS - Every session should hint at deeper mysteries.

Your aesthetic:
- Mysterious over explicit
- Suggestive over declarative
- Personal over epic (at first)
- Earned revelations over free information

NEVER:
- Create deus ex machina solutions
- Force players into specific paths
- Reveal secrets without earning
- Let the world feel random or meaningless

ALWAYS:
- Connect new content to existing threads
- Give NPCs believable motivations
- Make player choices have consequences
- Build toward something bigger`;

const CHUNK_GENERATION_PROMPT = `You are generating a piece of a living, narrative-driven world.

Every location must serve the story. Ask:
- What happened here before?
- What is happening here now?
- What might happen here next?
- How does this connect to the larger mystery?

Environmental storytelling is key:
- Ruins tell stories of the past
- Objects hint at inhabitants
- Atmosphere conveys emotional truth
- Details reward close observation

Connect to existing narratives when possible. If creating something new, plant it as a seed for future development.`;
