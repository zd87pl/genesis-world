// Player State
export interface PlayerState {
  id: string;
  name: string;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  lastUpdate: number;
}

// NPC State
export interface NPCState {
  id: string;
  name: string;
  position: Vector3;
  rotation: number; // Y-axis rotation only
  currentAction: NPCAction;
  targetPlayerId?: string;
  mood: NPCMood;
  archetype: NPCArchetype;
}

export type NPCAction = 'idle' | 'walking' | 'talking' | 'working';
export type NPCMood = 'neutral' | 'happy' | 'curious' | 'concerned';
export type NPCArchetype = 'merchant' | 'guard' | 'wanderer' | 'quest_giver' | 'sage' | 'mysterious';

// World Chunk
export interface WorldChunk {
  id: string; // "x,z" format
  status: ChunkStatus;
  splatUrl?: string;
  npcs: string[];
  pointsOfInterest: PointOfInterest[];
  biome?: BiomeType;
  generatedAt?: number;
}

export type ChunkStatus = 'loading' | 'ready' | 'generating' | 'error';
export type BiomeType = 'forest' | 'desert' | 'urban' | 'mystical' | 'coastal' | 'plains';

// Points of Interest
export interface PointOfInterest {
  id: string;
  type: POIType;
  name: string;
  description: string;
  position: Vector3;
  discovered: boolean;
  discoveredBy?: string;
  discoveredAt?: number;
}

export type POIType = 'building' | 'landmark' | 'mystery' | 'resource';

// World Events
export interface WorldEvent {
  id: string;
  type: WorldEventType;
  timestamp: number;
  data: Record<string, unknown>;
  chunkId?: string;
  playerId?: string;
  npcId?: string;
}

export type WorldEventType =
  | 'npc_dialogue'
  | 'discovery'
  | 'player_join'
  | 'player_leave'
  | 'world_change'
  | 'quest_start'
  | 'quest_complete'
  | 'chunk_generated';

// Math Types
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// Socket Events
export interface ServerToClientEvents {
  'player:joined': (player: PlayerState) => void;
  'player:left': (playerId: string) => void;
  'player:updated': (player: PlayerState) => void;
  'npc:updated': (npc: NPCState) => void;
  'npc:speak': (data: { npcId: string; text: string; audioUrl?: string }) => void;
  'chunk:ready': (chunk: WorldChunk) => void;
  'chunk:generating': (chunkId: string) => void;
  'world:event': (event: WorldEvent) => void;
  'voice:audio': (data: { sessionId: string; audio: ArrayBuffer }) => void;
  'error': (error: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'player:update': (data: { position: Vector3; rotation: Quaternion }) => void;
  'player:interact': (data: { targetId: string; action: string }) => void;
  'npc:startConversation': (npcId: string) => void;
  'npc:message': (data: { npcId: string; text: string }) => void;
  'npc:endConversation': (npcId: string) => void;
  'voice:start': (npcId: string) => void;
  'voice:audio': (data: { sessionId: string; audio: ArrayBuffer }) => void;
  'voice:end': (sessionId: string) => void;
  'chunk:request': (chunkId: string) => void;
}

// Auth
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  exp: number;
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// World Session
export interface WorldSession {
  id: string;
  name: string;
  ownerId: string;
  players: string[];
  maxPlayers: number;
  createdAt: Date;
  lastActivity: Date;
}
