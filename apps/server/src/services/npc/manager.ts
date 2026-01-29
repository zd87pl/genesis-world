import type { NPCState, NPCMood } from '@genesis/shared';
import { WorldStateManager } from '../sync/state-manager.js';
import { config } from '../../config.js';

interface NPCConversation {
  npcId: string;
  playerId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  startedAt: number;
  onResponse: (text: string, emotion: string) => void;
}

interface NPCPersonality {
  name: string;
  role: string;
  personality: string;
  backstory: string;
  greetings: string[];
  topics: string[];
}

const NPC_PERSONALITIES: Record<string, NPCPersonality> = {
  npc_guide: {
    name: 'Elder Sage',
    role: 'quest_giver',
    personality: 'Wise, patient, and slightly mysterious. Speaks in riddles occasionally.',
    backstory:
      'Has watched over the Genesis Crystal for centuries. Knows much about the world but reveals information only to those who prove worthy.',
    greetings: [
      'Ah, a new traveler. The Crystal foretold your arrival.',
      'Welcome, young one. The world has been waiting for you.',
      "Greetings. I sense great potential within you. Tell me, what brings you to this place?",
    ],
    topics: ['world history', 'quests', 'the crystal', 'nearby locations'],
  },
};

export class NPCManager {
  private worldState: WorldStateManager;
  private conversations: Map<string, NPCConversation> = new Map();
  private npcTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(worldState: WorldStateManager) {
    this.worldState = worldState;
    this.initializeNPCBehaviors();
  }

  private initializeNPCBehaviors(): void {
    // Set up idle behavior timers for each NPC
    const npcs = this.worldState.getNPCs();
    for (const npc of npcs) {
      this.startIdleBehavior(npc.id);
    }
  }

  private startIdleBehavior(npcId: string): void {
    // Random idle actions every 5-15 seconds
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 10000;
      const timer = setTimeout(() => {
        this.performIdleAction(npcId);
        scheduleNext();
      }, delay);

      this.npcTimers.set(npcId, timer);
    };

    scheduleNext();
  }

  private performIdleAction(npcId: string): void {
    const npc = this.worldState.getNPC(npcId);
    if (!npc || npc.currentAction === 'talking') return;

    // Random idle behaviors
    const actions: Array<() => void> = [
      // Look around
      () => {
        npc.rotation += (Math.random() - 0.5) * 0.5;
      },
      // Small position adjustment
      () => {
        npc.position.x += (Math.random() - 0.5) * 0.5;
        npc.position.z += (Math.random() - 0.5) * 0.5;
      },
      // Do nothing (most common)
      () => {},
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    action();

    this.worldState.updateNPC(npc);
  }

  handleInteraction(npcId: string, playerId: string, action: string): void {
    console.log(`NPC ${npcId} handling interaction from ${playerId}: ${action}`);

    const npc = this.worldState.getNPC(npcId);
    if (!npc) return;

    // Turn to face the player
    const player = this.worldState.getPlayer(playerId);
    if (player) {
      const dx = player.position.x - npc.position.x;
      const dz = player.position.z - npc.position.z;
      npc.rotation = Math.atan2(dx, dz);
      this.worldState.updateNPC(npc);
    }
  }

  startConversation(
    npcId: string,
    playerId: string,
    onResponse: (text: string, emotion: string) => void
  ): void {
    const conversationKey = `${npcId}-${playerId}`;

    // End any existing conversation
    if (this.conversations.has(conversationKey)) {
      this.endConversation(npcId, playerId);
    }

    const conversation: NPCConversation = {
      npcId,
      playerId,
      messages: [],
      startedAt: Date.now(),
      onResponse,
    };

    this.conversations.set(conversationKey, conversation);

    // Get NPC personality
    const personality = NPC_PERSONALITIES[npcId];

    // Send greeting
    const greeting =
      personality?.greetings[
        Math.floor(Math.random() * personality.greetings.length)
      ] || 'Hello, traveler.';

    conversation.messages.push({ role: 'assistant', content: greeting });
    onResponse(greeting, 'neutral');
  }

  async sendMessage(npcId: string, playerId: string, text: string): Promise<void> {
    const conversationKey = `${npcId}-${playerId}`;
    const conversation = this.conversations.get(conversationKey);

    if (!conversation) {
      console.warn(`No active conversation for ${conversationKey}`);
      return;
    }

    conversation.messages.push({ role: 'user', content: text });

    // Generate response
    const response = await this.generateResponse(npcId, conversation.messages);

    conversation.messages.push({ role: 'assistant', content: response.text });
    conversation.onResponse(response.text, response.emotion);
  }

  private async generateResponse(
    npcId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ text: string; emotion: string }> {
    const personality = NPC_PERSONALITIES[npcId];

    // If no API key, use fallback responses
    if (!config.anthropicApiKey) {
      return this.getFallbackResponse(npcId, messages);
    }

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

      const systemPrompt = personality
        ? `You are ${personality.name}, a ${personality.role} in a virtual world.

Personality: ${personality.personality}
Backstory: ${personality.backstory}
Topics you know about: ${personality.topics.join(', ')}

Keep responses concise (1-3 sentences). Stay in character. Be helpful but mysterious.`
        : 'You are an NPC in a virtual world. Keep responses brief and helpful.';

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Detect emotion from response
        const emotion = this.detectEmotion(content.text);
        return { text: content.text, emotion };
      }

      return { text: 'Hmm, I seem to have lost my train of thought.', emotion: 'concerned' };
    } catch (error) {
      console.error('Failed to generate NPC response:', error);
      return this.getFallbackResponse(npcId, messages);
    }
  }

  private getFallbackResponse(
    npcId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): { text: string; emotion: string } {
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';

    // Simple keyword-based responses
    if (lastMessage.includes('hello') || lastMessage.includes('hi')) {
      return { text: 'Greetings, traveler. How may I assist you?', emotion: 'happy' };
    }
    if (lastMessage.includes('quest') || lastMessage.includes('mission')) {
      return {
        text: 'Ah, seeking purpose? The world holds many mysteries. Perhaps start by exploring the areas beyond the crystal.',
        emotion: 'curious',
      };
    }
    if (lastMessage.includes('crystal')) {
      return {
        text: 'The Genesis Crystal has stood here since time began. It is said to be connected to all things in this world.',
        emotion: 'neutral',
      };
    }
    if (lastMessage.includes('help')) {
      return {
        text: 'I can tell you about this world, offer guidance, or point you toward adventure. What interests you?',
        emotion: 'happy',
      };
    }
    if (lastMessage.includes('bye') || lastMessage.includes('goodbye')) {
      return { text: 'Safe travels, young one. May the Crystal light your path.', emotion: 'neutral' };
    }

    // Default responses
    const defaults = [
      { text: 'Interesting... Tell me more.', emotion: 'curious' },
      { text: 'The world holds many secrets. Keep exploring.', emotion: 'neutral' },
      { text: 'Hmm, I shall ponder this.', emotion: 'neutral' },
    ];

    return defaults[Math.floor(Math.random() * defaults.length)];
  }

  private detectEmotion(text: string): string {
    const lower = text.toLowerCase();

    if (lower.includes('!') || lower.includes('wonderful') || lower.includes('excellent')) {
      return 'happy';
    }
    if (lower.includes('?') || lower.includes('curious') || lower.includes('interesting')) {
      return 'curious';
    }
    if (lower.includes('danger') || lower.includes('careful') || lower.includes('warning')) {
      return 'concerned';
    }

    return 'neutral';
  }

  endConversation(npcId: string, playerId: string): void {
    const conversationKey = `${npcId}-${playerId}`;
    this.conversations.delete(conversationKey);
  }

  handlePlayerDisconnect(playerId: string): void {
    // End all conversations involving this player
    for (const [key, conversation] of this.conversations) {
      if (conversation.playerId === playerId) {
        this.conversations.delete(key);
      }
    }
  }

  dispose(): void {
    // Clear all timers
    for (const timer of this.npcTimers.values()) {
      clearTimeout(timer);
    }
    this.npcTimers.clear();
    this.conversations.clear();
  }
}
