export interface PlayerState {
    id: string;
    name: string;
    position: Vector3;
    rotation: Quaternion;
    velocity: Vector3;
    lastUpdate: number;
}
export interface NPCState {
    id: string;
    name: string;
    position: Vector3;
    rotation: number;
    currentAction: NPCAction;
    targetPlayerId?: string;
    mood: NPCMood;
    archetype: NPCArchetype;
}
export type NPCAction = 'idle' | 'walking' | 'talking' | 'working';
export type NPCMood = 'neutral' | 'happy' | 'curious' | 'concerned';
export type NPCArchetype = 'merchant' | 'guard' | 'wanderer' | 'quest_giver';
export interface WorldChunk {
    id: string;
    status: ChunkStatus;
    splatUrl?: string;
    npcs: string[];
    pointsOfInterest: PointOfInterest[];
    biome?: BiomeType;
    generatedAt?: number;
}
export type ChunkStatus = 'loading' | 'ready' | 'generating' | 'error';
export type BiomeType = 'forest' | 'desert' | 'urban' | 'mystical' | 'coastal' | 'plains';
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
export interface WorldEvent {
    id: string;
    type: WorldEventType;
    timestamp: number;
    data: Record<string, unknown>;
    chunkId?: string;
    playerId?: string;
    npcId?: string;
}
export type WorldEventType = 'npc_dialogue' | 'discovery' | 'player_join' | 'player_leave' | 'world_change' | 'quest_start' | 'quest_complete' | 'chunk_generated';
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
export interface ServerToClientEvents {
    'player:joined': (player: PlayerState) => void;
    'player:left': (playerId: string) => void;
    'player:updated': (player: PlayerState) => void;
    'npc:updated': (npc: NPCState) => void;
    'npc:speak': (data: {
        npcId: string;
        text: string;
        audioUrl?: string;
    }) => void;
    'chunk:ready': (chunk: WorldChunk) => void;
    'chunk:generating': (chunkId: string) => void;
    'world:event': (event: WorldEvent) => void;
    'voice:audio': (data: {
        sessionId: string;
        audio: ArrayBuffer;
    }) => void;
    'error': (error: {
        code: string;
        message: string;
    }) => void;
}
export interface ClientToServerEvents {
    'player:update': (data: {
        position: Vector3;
        rotation: Quaternion;
    }) => void;
    'player:interact': (data: {
        targetId: string;
        action: string;
    }) => void;
    'npc:startConversation': (npcId: string) => void;
    'npc:message': (data: {
        npcId: string;
        text: string;
    }) => void;
    'npc:endConversation': (npcId: string) => void;
    'voice:start': (npcId: string) => void;
    'voice:audio': (data: {
        sessionId: string;
        audio: ArrayBuffer;
    }) => void;
    'voice:end': (sessionId: string) => void;
    'chunk:request': (chunkId: string) => void;
}
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
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
export interface WorldSession {
    id: string;
    name: string;
    ownerId: string;
    players: string[];
    maxPlayers: number;
    createdAt: Date;
    lastActivity: Date;
}
//# sourceMappingURL=types.d.ts.map