import type { NPCGameAction, PlayerGameAction, PayoffMatrix } from './payoff-matrix.js';
import { NPC_MATRICES } from './payoff-matrix.js';

export interface NPCContext {
  archetype: string;
  mood: number; // -1 to 1
  trustLevel: number; // -1 to 1
  resourceLevel: number; // 0 to 1
  threatLevel: number; // 0 to 1
  recentInteractions: PlayerGameAction[];
}

/**
 * Adjust payoff matrix based on NPC context
 */
export function adjustMatrixForContext(
  base: PayoffMatrix,
  context: NPCContext
): PayoffMatrix {
  const adjusted: PayoffMatrix = {};

  for (const npcAction of Object.keys(base)) {
    adjusted[npcAction] = {};

    for (const playerAction of Object.keys(base[npcAction])) {
      const [npcPayoff, playerPayoff] = base[npcAction][playerAction];

      let adjustedNpcPayoff = npcPayoff;

      // Trust affects cooperation payoffs
      if (npcAction === 'cooperate') {
        adjustedNpcPayoff += context.trustLevel * 2;
      }

      // Low resources make defection more tempting
      if (npcAction === 'defect') {
        adjustedNpcPayoff += (1 - context.resourceLevel) * 2;
      }

      // High threat makes fleeing more attractive
      if (npcAction === 'flee') {
        adjustedNpcPayoff += context.threatLevel * 3;
      }

      // Mood affects all social interactions
      if (['cooperate', 'neutral'].includes(npcAction)) {
        adjustedNpcPayoff += context.mood;
      }

      adjusted[npcAction][playerAction] = [adjustedNpcPayoff, playerPayoff];
    }
  }

  return adjusted;
}

/**
 * Get the best response to an anticipated player action
 */
export function bestResponseTo(
  matrix: PayoffMatrix,
  playerAction: PlayerGameAction
): NPCGameAction {
  let bestAction: NPCGameAction = 'neutral';
  let bestPayoff = -Infinity;

  for (const npcAction of Object.keys(matrix) as NPCGameAction[]) {
    const payoff = matrix[npcAction][playerAction]?.[0] ?? -Infinity;
    if (payoff > bestPayoff) {
      bestPayoff = payoff;
      bestAction = npcAction;
    }
  }

  return bestAction;
}

/**
 * Predict player's likely action based on history
 */
export function predictPlayerAction(
  recentHistory: PlayerGameAction[]
): PlayerGameAction | undefined {
  if (recentHistory.length < 3) return undefined;

  // Frequency-based prediction from last 10 actions
  const counts = new Map<PlayerGameAction, number>();
  for (const action of recentHistory.slice(-10)) {
    counts.set(action, (counts.get(action) || 0) + 1);
  }

  let mostFrequent: PlayerGameAction = 'friendly';
  let maxCount = 0;

  counts.forEach((count, action) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = action;
    }
  });

  // Only predict if there's a clear pattern (40%+)
  const historyLength = Math.min(recentHistory.length, 10);
  if (maxCount >= historyLength * 0.4) {
    return mostFrequent;
  }

  return undefined;
}

/**
 * Get base matrix for an NPC archetype
 */
export function getMatrixForArchetype(archetype: string): PayoffMatrix {
  return NPC_MATRICES[archetype] || NPC_MATRICES.wanderer;
}
