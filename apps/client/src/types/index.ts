// Re-export shared types
export * from '@genesis/shared';

// Client-specific types
export interface LoadingState {
  progress: number;
  status: string;
  isLoading: boolean;
}

export interface RenderStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  loadedChunks: number;
}

export interface InputState {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  interact: boolean;
}

export interface ConversationState {
  active: boolean;
  npcId: string | null;
  npcName: string | null;
  messages: ConversationMessage[];
  isListening: boolean;
  isSpeaking: boolean;
}

export interface ConversationMessage {
  id: string;
  sender: 'player' | 'npc';
  text: string;
  timestamp: number;
}

// Three.js type augmentations
declare module 'three' {
  interface WebGPURenderer extends WebGLRenderer {
    // WebGPU-specific methods if needed
  }
}
