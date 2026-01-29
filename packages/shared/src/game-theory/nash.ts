import type { PayoffMatrix, NPCGameAction, PlayerGameAction } from './payoff-matrix.js';

export interface StrategyProfile {
  npcStrategy: Map<NPCGameAction, number>;
  playerStrategy: Map<PlayerGameAction, number>;
  expectedPayoffs: [number, number];
}

/**
 * Find approximate mixed Nash equilibrium using fictitious play algorithm
 */
export function findMixedNashEquilibrium(
  matrix: PayoffMatrix,
  iterations: number = 10000
): StrategyProfile {
  const npcActions = Object.keys(matrix) as NPCGameAction[];
  const playerActions = Object.keys(matrix[npcActions[0]]) as PlayerGameAction[];

  // Count how often each action is played
  const npcCounts = new Map<NPCGameAction, number>();
  const playerCounts = new Map<PlayerGameAction, number>();

  npcActions.forEach((a) => npcCounts.set(a, 1));
  playerActions.forEach((a) => playerCounts.set(a, 1));

  for (let i = 0; i < iterations; i++) {
    // Player best responds to NPC's empirical distribution
    const playerBestResponse = findBestResponseForPlayer(
      matrix,
      npcCounts,
      playerActions
    );
    playerCounts.set(
      playerBestResponse,
      (playerCounts.get(playerBestResponse) || 0) + 1
    );

    // NPC best responds to player's empirical distribution
    const npcBestResponse = findBestResponseForNPC(
      matrix,
      playerCounts,
      npcActions
    );
    npcCounts.set(npcBestResponse, (npcCounts.get(npcBestResponse) || 0) + 1);
  }

  // Convert counts to probabilities
  const totalNpc = Array.from(npcCounts.values()).reduce((a, b) => a + b, 0);
  const totalPlayer = Array.from(playerCounts.values()).reduce(
    (a, b) => a + b,
    0
  );

  const npcStrategy = new Map<NPCGameAction, number>();
  const playerStrategy = new Map<PlayerGameAction, number>();

  npcCounts.forEach((count, action) => {
    npcStrategy.set(action, count / totalNpc);
  });

  playerCounts.forEach((count, action) => {
    playerStrategy.set(action, count / totalPlayer);
  });

  const expectedPayoffs = calculateExpectedPayoffs(
    matrix,
    npcStrategy,
    playerStrategy
  );

  return { npcStrategy, playerStrategy, expectedPayoffs };
}

function findBestResponseForPlayer(
  matrix: PayoffMatrix,
  npcDist: Map<NPCGameAction, number>,
  playerActions: PlayerGameAction[]
): PlayerGameAction {
  const total = Array.from(npcDist.values()).reduce((a, b) => a + b, 0);
  let bestAction = playerActions[0];
  let bestPayoff = -Infinity;

  for (const playerAction of playerActions) {
    let expectedPayoff = 0;

    npcDist.forEach((count, npcAction) => {
      const prob = count / total;
      const payoffs = matrix[npcAction]?.[playerAction];

      if (payoffs) {
        expectedPayoff += prob * payoffs[1]; // Player payoff
      }
    });

    if (expectedPayoff > bestPayoff) {
      bestPayoff = expectedPayoff;
      bestAction = playerAction;
    }
  }

  return bestAction;
}

function findBestResponseForNPC(
  matrix: PayoffMatrix,
  playerDist: Map<PlayerGameAction, number>,
  npcActions: NPCGameAction[]
): NPCGameAction {
  const total = Array.from(playerDist.values()).reduce((a, b) => a + b, 0);
  let bestAction = npcActions[0];
  let bestPayoff = -Infinity;

  for (const npcAction of npcActions) {
    let expectedPayoff = 0;

    playerDist.forEach((count, playerAction) => {
      const prob = count / total;
      const payoffs = matrix[npcAction]?.[playerAction];

      if (payoffs) {
        expectedPayoff += prob * payoffs[0]; // NPC payoff
      }
    });

    if (expectedPayoff > bestPayoff) {
      bestPayoff = expectedPayoff;
      bestAction = npcAction;
    }
  }

  return bestAction;
}

function calculateExpectedPayoffs(
  matrix: PayoffMatrix,
  npcStrategy: Map<NPCGameAction, number>,
  playerStrategy: Map<PlayerGameAction, number>
): [number, number] {
  let npcExpected = 0;
  let playerExpected = 0;

  npcStrategy.forEach((npcProb, npcAction) => {
    playerStrategy.forEach((playerProb, playerAction) => {
      const payoffs = matrix[npcAction]?.[playerAction];
      if (payoffs) {
        npcExpected += npcProb * playerProb * payoffs[0];
        playerExpected += npcProb * playerProb * payoffs[1];
      }
    });
  });

  return [npcExpected, playerExpected];
}

/**
 * Sample an action from a probability distribution
 */
export function sampleFromStrategy<T>(strategy: Map<T, number>): T {
  const rand = Math.random();
  let cumulative = 0;

  for (const [action, prob] of strategy) {
    cumulative += prob;
    if (rand < cumulative) {
      return action;
    }
  }

  // Fallback to first action
  return strategy.keys().next().value;
}
