/**
 * Local NPC dialogue system - works without external APIs
 * Uses template-based responses with personality variations
 */

export interface NPCPersonality {
  name: string;
  archetype: 'merchant' | 'guard' | 'wanderer' | 'quest_giver' | 'sage';
  greeting: string[];
  farewell: string[];
  idle: string[];
  topics: Record<string, string[]>;
  personality: {
    friendliness: number; // 0-1
    mystery: number; // 0-1
    helpfulness: number; // 0-1
  };
}

export interface DialogueMessage {
  id: string;
  speaker: 'player' | 'npc';
  text: string;
  timestamp: number;
}

export interface DialogueState {
  npcId: string;
  npcName: string;
  messages: DialogueMessage[];
  isActive: boolean;
  topicsDiscussed: string[];
}

// Pre-defined NPC personalities for the demo
export const NPC_PERSONALITIES: Record<string, NPCPersonality> = {
  sage_elara: {
    name: 'Sage Elara',
    archetype: 'sage',
    greeting: [
      "Ah, a traveler... The crystals foretold your arrival.",
      "Welcome, seeker. I sense great curiosity within you.",
      "The winds of fate have guided you here. What knowledge do you seek?",
    ],
    farewell: [
      "May the ancient light guide your path.",
      "Return when the crystals call to you again.",
      "Walk carefully, traveler. This world holds many secrets.",
    ],
    idle: [
      "*studies the glowing runes intently*",
      "*gazes at the floating crystal*",
      "*traces ancient symbols in the air*",
    ],
    topics: {
      crystal: [
        "The Genesis Crystal... It has been here since before memory. Some say it holds the dreams of a dying world.",
        "Few can perceive its true nature. It resonates with those who carry purpose in their hearts.",
        "Touch it not with hands, but with intention. It responds to will, not force.",
      ],
      ruins: [
        "These ruins predate even the eldest trees. The builders... we call them the Architects, though no one knows their true name.",
        "Each pillar was a conduit. Together they formed a network spanning the world. Most are broken now.",
        "The broken pillars weep for what was lost. But some power yet remains.",
      ],
      world: [
        "This realm exists in the space between thoughts. Every visitor shapes it, though most never realize.",
        "The land grows and changes. New places appear where explorers dream them into being.",
        "Be mindful of your desires here. Reality is... malleable.",
      ],
      yourself: [
        "I am a keeper of forgotten knowledge. I have watched this place for... I no longer count the cycles.",
        "Once I was a seeker like you. Now I am part of the land's memory.",
        "My purpose is to guide those who wander here. The crystals chose me for this task.",
      ],
      help: [
        "Explore the land. Follow the rune stones - they mark paths to places of power.",
        "Speak with others you meet. Each carries a piece of the greater truth.",
        "Trust your instincts. This world rewards the curious and the brave.",
      ],
      danger: [
        "Not all that wanders is benevolent. The shadows at the world's edge... they hunger.",
        "The further from the crystal's light, the stranger things become.",
        "Fear not death here - but beware losing yourself. That is the true danger.",
      ],
    },
    personality: {
      friendliness: 0.7,
      mystery: 0.9,
      helpfulness: 0.8,
    },
  },

  wanderer_finn: {
    name: 'Finn the Wanderer',
    archetype: 'wanderer',
    greeting: [
      "Hey there, friend! Don't see many new faces around here.",
      "Another traveler! Come, come - tell me of the roads you've walked.",
      "Well met! The path brought you here too, eh?",
    ],
    farewell: [
      "Safe travels! Maybe we'll cross paths again.",
      "The road calls to both of us. Until next time!",
      "Keep wandering, friend. There's always more to see.",
    ],
    idle: [
      "*adjusts pack and stretches*",
      "*hums a wandering tune*",
      "*scans the horizon with interest*",
    ],
    topics: {
      crystal: [
        "Gives me the creeps, honestly. Beautiful, but... it feels like it's watching, you know?",
        "I've seen similar stones far to the east. Smaller, dimmer, but the same eerie glow.",
        "The sage could tell you more. She practically lives next to the thing.",
      ],
      ruins: [
        "Found some strange writing on the pillars once. Couldn't read it, but I made a sketch!",
        "I've explored a hundred ruins across this land. These are by far the oldest.",
        "At night, sometimes I hear sounds from underground. Probably just echoes... probably.",
      ],
      roads: [
        "To the north, forests thick as any I've seen. Strange lights between the trees at dusk.",
        "East leads to open plains - good traveling, though lonely.",
        "West... I don't go west. The land gets wrong somehow. Hard to explain.",
      ],
      yourself: [
        "Me? Just a soul who couldn't stay put. Started walking one day and never stopped.",
        "I've been everywhere and nowhere special. That's the wanderer's way.",
        "Home is wherever I hang my pack for the night. Works for me!",
      ],
      trade: [
        "I'm no merchant, but I pick up interesting things. Want to see what I've found?",
        "Found a peculiar stone last week - changes color in moonlight. Curious about it?",
        "If you're heading out, I'd suggest proper boots. The terrain here surprises you.",
      ],
    },
    personality: {
      friendliness: 0.9,
      mystery: 0.3,
      helpfulness: 0.7,
    },
  },
};

export class NPCDialogueSystem {
  private currentDialogue: DialogueState | null = null;
  private onMessageCallback: ((msg: DialogueMessage) => void) | null = null;

  startConversation(npcId: string, personality: NPCPersonality): DialogueState {
    const greeting = this.pickRandom(personality.greeting);

    const state: DialogueState = {
      npcId,
      npcName: personality.name,
      messages: [
        {
          id: this.generateId(),
          speaker: 'npc',
          text: greeting,
          timestamp: Date.now(),
        },
      ],
      isActive: true,
      topicsDiscussed: [],
    };

    this.currentDialogue = state;

    if (this.onMessageCallback) {
      this.onMessageCallback(state.messages[0]);
    }

    return state;
  }

  sendMessage(text: string, personality: NPCPersonality): DialogueMessage | null {
    if (!this.currentDialogue?.isActive) return null;

    // Add player message
    const playerMessage: DialogueMessage = {
      id: this.generateId(),
      speaker: 'player',
      text,
      timestamp: Date.now(),
    };
    this.currentDialogue.messages.push(playerMessage);

    if (this.onMessageCallback) {
      this.onMessageCallback(playerMessage);
    }

    // Generate NPC response
    const response = this.generateResponse(text.toLowerCase(), personality);

    const npcMessage: DialogueMessage = {
      id: this.generateId(),
      speaker: 'npc',
      text: response,
      timestamp: Date.now(),
    };

    // Simulate typing delay
    setTimeout(() => {
      if (this.currentDialogue) {
        this.currentDialogue.messages.push(npcMessage);
        if (this.onMessageCallback) {
          this.onMessageCallback(npcMessage);
        }
      }
    }, 500 + Math.random() * 1000);

    return npcMessage;
  }

  private generateResponse(input: string, personality: NPCPersonality): string {
    // Check for farewell
    if (this.containsAny(input, ['bye', 'goodbye', 'farewell', 'leave', 'go'])) {
      return this.pickRandom(personality.farewell);
    }

    // Check for topic matches
    for (const [topic, responses] of Object.entries(personality.topics)) {
      const keywords = this.getTopicKeywords(topic);
      if (this.containsAny(input, keywords)) {
        // Track discussed topics
        if (
          this.currentDialogue &&
          !this.currentDialogue.topicsDiscussed.includes(topic)
        ) {
          this.currentDialogue.topicsDiscussed.push(topic);
        }

        // Pick a response, avoiding repeats
        return this.pickResponse(responses, topic);
      }
    }

    // Generic responses based on personality
    return this.getGenericResponse(input, personality);
  }

  private getTopicKeywords(topic: string): string[] {
    const keywords: Record<string, string[]> = {
      crystal: ['crystal', 'stone', 'gem', 'glow', 'light', 'power'],
      ruins: ['ruins', 'pillars', 'ancient', 'old', 'builders', 'structure'],
      world: ['world', 'place', 'land', 'realm', 'here'],
      yourself: ['you', 'who are', 'your name', 'about you', 'yourself'],
      help: ['help', 'advice', 'what should', 'where', 'how do'],
      danger: ['danger', 'warning', 'safe', 'threat', 'afraid', 'scared'],
      roads: ['road', 'path', 'direction', 'travel', 'north', 'south', 'east', 'west'],
      trade: ['trade', 'buy', 'sell', 'have', 'items', 'stuff'],
    };
    return keywords[topic] || [topic];
  }

  private getGenericResponse(input: string, personality: NPCPersonality): string {
    // Check for greetings
    if (this.containsAny(input, ['hello', 'hi', 'hey', 'greetings'])) {
      return this.pickRandom([
        "Yes, hello again! What's on your mind?",
        "I'm here. What would you like to discuss?",
        "Hmm? Ask away, traveler.",
      ]);
    }

    // Check for questions
    if (input.includes('?')) {
      if (personality.personality.mystery > 0.7) {
        return this.pickRandom([
          "That is a question even the crystals cannot answer.",
          "Some mysteries are not meant to be unraveled... yet.",
          "In time, the answers will reveal themselves.",
          "Seek and you shall find. That is all I can say.",
        ]);
      } else {
        return this.pickRandom([
          "Hmm, that's a good question. I'm not entirely sure myself.",
          "I've wondered about that too. No clear answers yet.",
          "Ask the sage about that - she knows more than me!",
          "If I figure that out, you'll be the first to know.",
        ]);
      }
    }

    // Check for thanks
    if (this.containsAny(input, ['thank', 'thanks', 'appreciate'])) {
      return this.pickRandom([
        "You're welcome, traveler.",
        "Happy to help.",
        "Of course. That's what I'm here for.",
        "Think nothing of it.",
      ]);
    }

    // Default curious/engaged responses
    if (personality.personality.friendliness > 0.7) {
      return this.pickRandom([
        "Interesting... Tell me more?",
        "I see! What else is on your mind?",
        "Fascinating. Anything else you'd like to know?",
        "Hmm, I understand. Is there something specific you're looking for?",
      ]);
    } else {
      return this.pickRandom([
        "Perhaps. What else do you wish to discuss?",
        "Noted. Anything else?",
        "I see. Continue.",
        "Very well. What brings you here?",
      ]);
    }
  }

  private pickResponse(responses: string[], topic: string): string {
    // Try to avoid repeating the same response
    if (this.currentDialogue) {
      const usedResponses = this.currentDialogue.messages
        .filter((m) => m.speaker === 'npc')
        .map((m) => m.text);

      const available = responses.filter((r) => !usedResponses.includes(r));
      if (available.length > 0) {
        return this.pickRandom(available);
      }
    }

    return this.pickRandom(responses);
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  endConversation(): void {
    if (this.currentDialogue) {
      this.currentDialogue.isActive = false;
    }
    this.currentDialogue = null;
  }

  onMessage(callback: (msg: DialogueMessage) => void): void {
    this.onMessageCallback = callback;
  }

  getCurrentDialogue(): DialogueState | null {
    return this.currentDialogue;
  }

  getAvailableTopics(personality: NPCPersonality): string[] {
    return Object.keys(personality.topics);
  }

  getSuggestedQuestions(personality: NPCPersonality): string[] {
    const suggestions: string[] = [];

    const topicQuestions: Record<string, string[]> = {
      crystal: ["What is that crystal?", "Tell me about the crystal"],
      ruins: ["What are these ruins?", "Who built this place?"],
      world: ["Where am I?", "What is this world?"],
      yourself: ["Who are you?", "Tell me about yourself"],
      help: ["What should I do?", "Can you help me?"],
      roads: ["Where can I go?", "What's out there?"],
    };

    for (const topic of Object.keys(personality.topics)) {
      if (topicQuestions[topic]) {
        suggestions.push(this.pickRandom(topicQuestions[topic]));
      }
    }

    return suggestions.slice(0, 4); // Return max 4 suggestions
  }
}
