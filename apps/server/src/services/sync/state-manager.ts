import type { PlayerState, NPCState, WorldChunk, WorldEvent } from '@genesis/shared';
import { createChunk, determineBiome } from '@genesis/shared/world';

export class WorldStateManager {
  private players: Map<string, PlayerState> = new Map();
  private npcs: Map<string, NPCState> = new Map();
  private chunks: Map<string, WorldChunk> = new Map();
  private events: WorldEvent[] = [];

  constructor() {
    // Initialize spawn chunk
    this.initializeSpawnArea();
  }

  private initializeSpawnArea(): void {
    // Create spawn chunk
    const spawnChunk = createChunk('0,0', {
      status: 'ready',
      biome: 'plains',
      npcs: ['npc_guide'],
      pointsOfInterest: [
        {
          id: 'poi_spawn_crystal',
          type: 'landmark',
          name: 'Genesis Crystal',
          description: 'A mysterious glowing crystal that marks the center of the world.',
          position: { x: 0, y: 3, z: 10 },
          discovered: true,
        },
        {
          id: 'poi_spawn_well',
          type: 'building',
          name: 'Ancient Well',
          description: 'An old well that seems to whisper secrets.',
          position: { x: -15, y: 0, z: 5 },
          discovered: false,
        },
      ],
      generatedAt: Date.now(),
    });

    this.chunks.set('0,0', spawnChunk);

    // Create initial NPC
    const guideNPC: NPCState = {
      id: 'npc_guide',
      name: 'Elder Sage',
      position: { x: 5, y: 0, z: 8 },
      rotation: Math.PI, // Facing spawn point
      currentAction: 'idle',
      mood: 'neutral',
      archetype: 'quest_giver',
    };

    this.npcs.set('npc_guide', guideNPC);
  }

  // Player methods
  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player);
    this.addEvent({
      id: `event_${Date.now()}`,
      type: 'player_join',
      timestamp: Date.now(),
      data: { playerId: player.id, name: player.name },
      playerId: player.id,
    });
  }

  updatePlayer(player: PlayerState): void {
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.addEvent({
      id: `event_${Date.now()}`,
      type: 'player_leave',
      timestamp: Date.now(),
      data: { playerId },
      playerId,
    });
  }

  getPlayer(playerId: string): PlayerState | undefined {
    return this.players.get(playerId);
  }

  getPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  getActivePlayers(): PlayerState[] {
    const now = Date.now();
    const timeout = 60000; // 1 minute
    return this.getPlayers().filter((p) => now - p.lastUpdate < timeout);
  }

  // NPC methods
  addNPC(npc: NPCState): void {
    this.npcs.set(npc.id, npc);
  }

  updateNPC(npc: NPCState): void {
    this.npcs.set(npc.id, npc);
  }

  removeNPC(npcId: string): void {
    this.npcs.delete(npcId);
  }

  getNPC(npcId: string): NPCState | undefined {
    return this.npcs.get(npcId);
  }

  getNPCs(): NPCState[] {
    return Array.from(this.npcs.values());
  }

  getNPCsInChunk(chunkId: string): NPCState[] {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return [];
    return chunk.npcs.map((id) => this.npcs.get(id)).filter(Boolean) as NPCState[];
  }

  // Chunk methods
  addChunk(chunk: WorldChunk): void {
    this.chunks.set(chunk.id, chunk);
    this.addEvent({
      id: `event_${Date.now()}`,
      type: 'chunk_generated',
      timestamp: Date.now(),
      data: { chunkId: chunk.id, biome: chunk.biome },
      chunkId: chunk.id,
    });
  }

  updateChunk(chunkId: string, updates: Partial<WorldChunk>): void {
    const chunk = this.chunks.get(chunkId);
    if (chunk) {
      Object.assign(chunk, updates);
    } else {
      // Create new chunk with updates
      const newChunk = createChunk(chunkId, {
        ...updates,
        biome: determineBiome(chunkId),
      });
      this.chunks.set(chunkId, newChunk);
    }
  }

  getChunk(chunkId: string): WorldChunk | undefined {
    return this.chunks.get(chunkId);
  }

  getChunks(): WorldChunk[] {
    return Array.from(this.chunks.values());
  }

  getLoadedChunks(): string[] {
    return Array.from(this.chunks.keys());
  }

  // Event methods
  addEvent(event: WorldEvent): void {
    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  getRecentEvents(count: number = 50): WorldEvent[] {
    return this.events.slice(-count);
  }

  getEventsForPlayer(playerId: string, count: number = 20): WorldEvent[] {
    return this.events
      .filter((e) => e.playerId === playerId || !e.playerId)
      .slice(-count);
  }

  // Snapshot for Game Master
  getSnapshot(): {
    players: PlayerState[];
    npcs: NPCState[];
    chunks: WorldChunk[];
    recentEvents: WorldEvent[];
  } {
    return {
      players: this.getActivePlayers(),
      npcs: this.getNPCs(),
      chunks: this.getChunks(),
      recentEvents: this.getRecentEvents(20),
    };
  }
}
