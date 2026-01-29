import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as THREE from 'three';
import type { PlayerState, NPCState, WorldChunk, WorldEvent } from '@genesis/shared';

export class WorldSync {
  private doc: Y.Doc;
  private provider: WebrtcProvider | null = null;
  private persistence: IndexeddbPersistence;

  // Shared state maps
  public players: Y.Map<PlayerState>;
  public npcs: Y.Map<NPCState>;
  public chunks: Y.Map<WorldChunk>;
  public events: Y.Array<WorldEvent>;

  private localPlayerId: string;
  private updateCallbacks: Set<() => void> = new Set();
  private lastUpdateTime = 0;
  private updateThrottle = 50; // ms

  constructor(roomId: string, playerId: string, playerName: string) {
    this.localPlayerId = playerId;
    this.doc = new Y.Doc();

    // Initialize shared types
    this.players = this.doc.getMap('players');
    this.npcs = this.doc.getMap('npcs');
    this.chunks = this.doc.getMap('chunks');
    this.events = this.doc.getArray('events');

    // Local persistence for offline support
    this.persistence = new IndexeddbPersistence(roomId, this.doc);

    // WebRTC provider for P2P sync
    try {
      this.provider = new WebrtcProvider(roomId, this.doc, {
        signaling: [
          'wss://signaling.yjs.dev',
          'wss://y-webrtc-signaling-eu.herokuapp.com',
          'wss://y-webrtc-signaling-us.herokuapp.com',
        ],
        maxConns: 10,
        filterBcConns: true,
      });

      // Set up awareness for player presence
      this.provider.awareness.setLocalStateField('user', {
        id: playerId,
        name: playerName,
        color: this.generateColor(playerId),
      });
    } catch (error) {
      console.warn('WebRTC provider failed to initialize:', error);
    }

    // Initialize local player
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      position: { x: 0, y: 1.6, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      lastUpdate: Date.now(),
    });

    // Listen for changes
    this.players.observe(this.onStateChange.bind(this));
    this.npcs.observe(this.onStateChange.bind(this));
    this.chunks.observe(this.onStateChange.bind(this));
  }

  updateLocalPlayer(position: THREE.Vector3, rotation: THREE.Quaternion): void {
    const current = this.players.get(this.localPlayerId);
    if (!current) return;

    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) return;
    this.lastUpdateTime = now;

    // Check if position/rotation actually changed
    const posChanged =
      Math.abs(position.x - current.position.x) > 0.01 ||
      Math.abs(position.y - current.position.y) > 0.01 ||
      Math.abs(position.z - current.position.z) > 0.01;

    const rotChanged =
      Math.abs(rotation.x - current.rotation.x) > 0.01 ||
      Math.abs(rotation.y - current.rotation.y) > 0.01 ||
      Math.abs(rotation.z - current.rotation.z) > 0.01 ||
      Math.abs(rotation.w - current.rotation.w) > 0.01;

    if (!posChanged && !rotChanged) return;

    this.players.set(this.localPlayerId, {
      ...current,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      lastUpdate: now,
    });
  }

  onUpdate(callback: () => void): void {
    this.updateCallbacks.add(callback);
  }

  offUpdate(callback: () => void): void {
    this.updateCallbacks.delete(callback);
  }

  private onStateChange(): void {
    this.updateCallbacks.forEach((cb) => cb());
  }

  getOtherPlayers(): PlayerState[] {
    const players: PlayerState[] = [];
    this.players.forEach((player, id) => {
      if (id !== this.localPlayerId) {
        // Filter out stale players (no update in 30 seconds)
        if (Date.now() - player.lastUpdate < 30000) {
          players.push(player);
        }
      }
    });
    return players;
  }

  getLocalPlayer(): PlayerState | undefined {
    return this.players.get(this.localPlayerId);
  }

  getNPCs(): NPCState[] {
    return Array.from(this.npcs.values());
  }

  getNPC(npcId: string): NPCState | undefined {
    return this.npcs.get(npcId);
  }

  getChunks(): WorldChunk[] {
    return Array.from(this.chunks.values());
  }

  getChunk(chunkId: string): WorldChunk | undefined {
    return this.chunks.get(chunkId);
  }

  getRecentEvents(count: number = 10): WorldEvent[] {
    const length = this.events.length;
    const start = Math.max(0, length - count);
    return this.events.slice(start, length);
  }

  // For server-initiated updates
  updateNPC(npc: NPCState): void {
    this.npcs.set(npc.id, npc);
  }

  updateChunk(chunk: WorldChunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  addEvent(event: WorldEvent): void {
    this.events.push([event]);

    // Keep only last 100 events
    if (this.events.length > 100) {
      this.doc.transact(() => {
        this.events.delete(0, this.events.length - 100);
      });
    }
  }

  private generateColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
  }

  getConnectedPeers(): number {
    if (!this.provider) return 0;
    return this.provider.awareness.getStates().size;
  }

  destroy(): void {
    // Remove local player before disconnecting
    this.players.delete(this.localPlayerId);

    this.provider?.destroy();
    this.persistence.destroy();
    this.doc.destroy();
  }
}
