import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PlayerState,
  NPCState,
  WorldChunk,
  WorldEvent,
} from '@genesis/shared';
import { SOCKET_RECONNECT_ATTEMPTS, SOCKET_RECONNECT_DELAY } from '@genesis/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketClient {
  private socket: TypedSocket | null = null;
  private playerId: string = '';
  private isConnected = false;

  // Event callbacks
  private onPlayerJoined: ((player: PlayerState) => void) | null = null;
  private onPlayerLeft: ((playerId: string) => void) | null = null;
  private onPlayerUpdated: ((player: PlayerState) => void) | null = null;
  private onNPCUpdated: ((npc: NPCState) => void) | null = null;
  private onNPCSpeak: ((data: { npcId: string; text: string; audioUrl?: string }) => void) | null = null;
  private onChunkReady: ((chunk: WorldChunk) => void) | null = null;
  private onWorldEvent: ((event: WorldEvent) => void) | null = null;
  private onVoiceAudio: ((data: { sessionId: string; audio: ArrayBuffer }) => void) | null = null;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Generate a client-side player ID
      this.playerId = this.generatePlayerId();

      this.socket = io({
        path: '/socket.io',
        reconnectionAttempts: SOCKET_RECONNECT_ATTEMPTS,
        reconnectionDelay: SOCKET_RECONNECT_DELAY,
        timeout: 10000,
        auth: {
          playerId: this.playerId,
        },
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        if (!this.isConnected) {
          reject(error);
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        this.isConnected = false;
      });

      // Set up event listeners
      this.setupEventListeners();
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('player:joined', (player) => {
      this.onPlayerJoined?.(player);
    });

    this.socket.on('player:left', (playerId) => {
      this.onPlayerLeft?.(playerId);
    });

    this.socket.on('player:updated', (player) => {
      this.onPlayerUpdated?.(player);
    });

    this.socket.on('npc:updated', (npc) => {
      this.onNPCUpdated?.(npc);
    });

    this.socket.on('npc:speak', (data) => {
      this.onNPCSpeak?.(data);
    });

    this.socket.on('chunk:ready', (chunk) => {
      this.onChunkReady?.(chunk);
    });

    this.socket.on('world:event', (event) => {
      this.onWorldEvent?.(event);
    });

    this.socket.on('voice:audio', (data) => {
      this.onVoiceAudio?.(data);
    });

    this.socket.on('error', (error) => {
      console.error('Server error:', error);
    });
  }

  // Send player position/rotation update
  updatePlayer(position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number; w: number }): void {
    this.socket?.emit('player:update', { position, rotation });
  }

  // Interact with an NPC or object
  interact(targetId: string, action: string): void {
    this.socket?.emit('player:interact', { targetId, action });
  }

  // Start conversation with NPC
  startConversation(npcId: string): void {
    this.socket?.emit('npc:startConversation', npcId);
  }

  // Send text message to NPC
  sendNPCMessage(npcId: string, text: string): void {
    this.socket?.emit('npc:message', { npcId, text });
  }

  // End conversation with NPC
  endConversation(npcId: string): void {
    this.socket?.emit('npc:endConversation', npcId);
  }

  // Start voice session
  startVoice(npcId: string): void {
    this.socket?.emit('voice:start', npcId);
  }

  // Send voice audio chunk
  sendVoiceAudio(sessionId: string, audio: ArrayBuffer): void {
    this.socket?.emit('voice:audio', { sessionId, audio });
  }

  // End voice session
  endVoice(sessionId: string): void {
    this.socket?.emit('voice:end', sessionId);
  }

  // Request chunk data
  requestChunk(chunkId: string): void {
    this.socket?.emit('chunk:request', chunkId);
  }

  // Event registration
  onPlayerJoin(callback: (player: PlayerState) => void): void {
    this.onPlayerJoined = callback;
  }

  onPlayerLeave(callback: (playerId: string) => void): void {
    this.onPlayerLeft = callback;
  }

  onPlayerUpdate(callback: (player: PlayerState) => void): void {
    this.onPlayerUpdated = callback;
  }

  onNPCUpdate(callback: (npc: NPCState) => void): void {
    this.onNPCUpdated = callback;
  }

  onNPCSpeakCallback(callback: (data: { npcId: string; text: string; audioUrl?: string }) => void): void {
    this.onNPCSpeak = callback;
  }

  onChunkReadyCallback(callback: (chunk: WorldChunk) => void): void {
    this.onChunkReady = callback;
  }

  onWorldEventCallback(callback: (event: WorldEvent) => void): void {
    this.onWorldEvent = callback;
  }

  onVoiceAudioCallback(callback: (data: { sessionId: string; audio: ArrayBuffer }) => void): void {
    this.onVoiceAudio = callback;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected = false;
  }

  private generatePlayerId(): string {
    // Check for existing ID in localStorage
    const stored = localStorage.getItem('genesis_player_id');
    if (stored) return stored;

    // Generate new ID
    const id = 'player_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('genesis_player_id', id);
    return id;
  }
}
