/**
 * Game Master Module
 * AI-orchestrated narrative intelligence for Genesis World
 */

export { GameMasterOrchestrator } from './orchestrator.js';
export { AIGameMaster } from './narrative-engine.js';
export { AIDirector } from './ai-director.js';

// Re-export types for consumers
export type {
  NPCDialogueContext,
  NPCDialogueResponse,
  WorldContext,
  NPCActionDecision,
  WorldEventInput,
} from './ai-director.js';
