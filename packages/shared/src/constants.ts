// World Configuration
export const CHUNK_SIZE = 100; // meters
export const CHUNK_LOAD_DISTANCE = 2; // chunks
export const CHUNK_UNLOAD_DISTANCE = 4; // chunks

// Player Configuration
export const PLAYER_HEIGHT = 1.6; // meters
export const PLAYER_MOVE_SPEED = 10; // m/s
export const PLAYER_MOUSE_SENSITIVITY = 0.002;
export const PLAYER_UPDATE_RATE = 20; // Hz

// NPC Configuration
export const NPC_INTERACTION_DISTANCE = 3; // meters
export const NPC_WANDER_RADIUS = 20; // meters
export const NPC_WANDER_SPEED = 2; // m/s

// Rendering
export const TARGET_FPS = 60;
export const MAX_VISIBLE_CHUNKS = 9; // 3x3 grid
export const LOD_DISTANCES = [50, 100, 200]; // meters

// Network
export const SOCKET_RECONNECT_ATTEMPTS = 5;
export const SOCKET_RECONNECT_DELAY = 1000; // ms
export const STATE_SYNC_INTERVAL = 50; // ms (20 Hz)

// Voice
export const VOICE_SAMPLE_RATE = 16000;
export const VOICE_CHUNK_SIZE = 4096;

// Game Master
export const GM_TICK_INTERVAL = 5000; // ms
export const GM_GENERATION_LOOKAHEAD = 2; // chunks ahead of player

// Spawn Configuration
export const SPAWN_POSITION = { x: 0, y: PLAYER_HEIGHT, z: 0 };
export const SPAWN_CHUNK_ID = '0,0';
