export type NPCGameAction =
  | 'cooperate'      // Help the player
  | 'defect'         // Act selfishly
  | 'neutral'        // Stay uninvolved
  | 'investigate'    // Gather more info
  | 'flee';          // Avoid interaction

export type PlayerGameAction =
  | 'friendly'       // Positive interaction
  | 'hostile'        // Negative interaction
  | 'trade'          // Exchange resources
  | 'inquire'        // Ask for information
  | 'ignore';        // No interaction

export interface PayoffMatrix {
  [npcAction: string]: {
    [playerAction: string]: [number, number]; // [npcPayoff, playerPayoff]
  };
}

// Different NPC archetypes have different payoff matrices
export const NPC_MATRICES: Record<string, PayoffMatrix> = {
  merchant: {
    cooperate: {
      friendly: [3, 3],
      hostile: [-2, 1],
      trade: [5, 4],
      inquire: [1, 2],
      ignore: [0, 0],
    },
    defect: {
      friendly: [4, -1],
      hostile: [-3, -3],
      trade: [2, -2],
      inquire: [1, -1],
      ignore: [0, 0],
    },
    neutral: {
      friendly: [1, 1],
      hostile: [-1, 0],
      trade: [2, 2],
      inquire: [0, 1],
      ignore: [0, 0],
    },
    investigate: {
      friendly: [2, 1],
      hostile: [0, 0],
      trade: [1, 2],
      inquire: [2, 2],
      ignore: [1, 0],
    },
    flee: {
      friendly: [-1, 0],
      hostile: [1, -1],
      trade: [-2, -1],
      inquire: [-1, 0],
      ignore: [0, 0],
    },
  },

  guard: {
    cooperate: {
      friendly: [2, 3],
      hostile: [-3, 2],
      trade: [-1, 1],
      inquire: [2, 3],
      ignore: [0, 0],
    },
    defect: {
      friendly: [1, -2],
      hostile: [2, -3],
      trade: [3, -2],
      inquire: [0, -1],
      ignore: [0, 0],
    },
    neutral: {
      friendly: [1, 1],
      hostile: [0, -2],
      trade: [0, 0],
      inquire: [1, 1],
      ignore: [1, 0],
    },
    investigate: {
      friendly: [1, 0],
      hostile: [2, -1],
      trade: [1, 0],
      inquire: [2, 1],
      ignore: [1, 0],
    },
    flee: {
      friendly: [-2, 0],
      hostile: [-1, 2],
      trade: [-1, 0],
      inquire: [-2, 0],
      ignore: [-1, 0],
    },
  },

  wanderer: {
    cooperate: {
      friendly: [4, 4],
      hostile: [-3, 0],
      trade: [3, 3],
      inquire: [3, 4],
      ignore: [-1, 0],
    },
    defect: {
      friendly: [2, -1],
      hostile: [-2, -2],
      trade: [1, -1],
      inquire: [0, -2],
      ignore: [0, 0],
    },
    neutral: {
      friendly: [2, 2],
      hostile: [-1, 0],
      trade: [2, 2],
      inquire: [2, 2],
      ignore: [0, 0],
    },
    investigate: {
      friendly: [3, 2],
      hostile: [0, 0],
      trade: [2, 2],
      inquire: [3, 3],
      ignore: [1, 0],
    },
    flee: {
      friendly: [0, -1],
      hostile: [2, 0],
      trade: [0, -1],
      inquire: [0, -1],
      ignore: [1, 0],
    },
  },

  quest_giver: {
    cooperate: {
      friendly: [4, 5],
      hostile: [-4, -1],
      trade: [3, 4],
      inquire: [4, 5],
      ignore: [-2, 0],
    },
    defect: {
      friendly: [1, -2],
      hostile: [-3, -3],
      trade: [0, -1],
      inquire: [-1, -2],
      ignore: [0, 0],
    },
    neutral: {
      friendly: [2, 2],
      hostile: [-2, -1],
      trade: [1, 2],
      inquire: [2, 3],
      ignore: [0, 0],
    },
    investigate: {
      friendly: [3, 3],
      hostile: [0, 0],
      trade: [2, 2],
      inquire: [4, 4],
      ignore: [1, 0],
    },
    flee: {
      friendly: [-2, -1],
      hostile: [0, 1],
      trade: [-1, -1],
      inquire: [-2, -1],
      ignore: [0, 0],
    },
  },
};
