import Anthropic from '@anthropic-ai/sdk';
import type { NPCState, PlayerState } from '@genesis/shared';

/**
 * AI Director - Handles real-time NPC behavior and dynamic responses
 * Works with the Narrative Engine for story-aware AI behavior
 */
export class AIDirector {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate dynamic NPC dialogue based on context
   */
  async generateNPCDialogue(
    npc: NPCState,
    playerMessage: string,
    context: NPCDialogueContext
  ): Promise<NPCDialogueResponse> {
    const systemPrompt = this.buildNPCSystemPrompt(npc, context);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        // Include conversation history
        ...context.conversationHistory.flatMap((msg) => [
          { role: 'user' as const, content: msg.playerText },
          { role: 'assistant' as const, content: msg.npcResponse },
        ]),
        // Current message
        { role: 'user' as const, content: playerMessage },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { text: "...", emotion: 'neutral', action: null };
    }

    // Parse response - expect JSON with text, emotion, and optional action
    try {
      // If the model returns plain text, wrap it
      if (!content.text.startsWith('{')) {
        return {
          text: content.text,
          emotion: this.inferEmotion(content.text),
          action: null,
        };
      }

      return JSON.parse(content.text) as NPCDialogueResponse;
    } catch {
      return {
        text: content.text,
        emotion: 'neutral',
        action: null,
      };
    }
  }

  private buildNPCSystemPrompt(npc: NPCState, context: NPCDialogueContext): string {
    const personalityTraits = NPC_PERSONALITIES[npc.archetype || 'wanderer'];

    return `You are ${npc.name}, an NPC in Genesis World.

## Your Core Identity
${personalityTraits.core}

## Your Current State
- Mood: ${npc.mood}
- Location: Near the ancient ruins
- Current activity: ${npc.currentAction}

## Relationship with this player
Trust level: ${context.relationship}/100
${context.relationship > 50 ? 'You are warming up to them.' : context.relationship < 0 ? 'You are wary of them.' : 'They are still a stranger.'}

## Previous interactions
${context.previousInteractions.length > 0
    ? context.previousInteractions.slice(-3).map(i => `- You discussed: ${i.topics.join(', ')}`).join('\n')
    : 'This is your first real conversation with them.'}

## Secrets you know (reveal gradually based on trust)
${context.secrets.map((s, i) => `${i + 1}. ${s} (reveal at trust ${30 + i * 20}+)`).join('\n')}

## Active story threads you're involved in
${context.activeNarratives.map(n => `- ${n.name}: ${n.hints[0] || 'No specific hints'}`).join('\n')}

## Your speech patterns
${personalityTraits.speechPatterns}

## Conversation rules
1. Stay in character always
2. Be helpful but mysterious - don't reveal everything
3. Reference past conversations when relevant
4. Hint at secrets only when trust is high enough
5. React emotionally to player tone
6. If asked about things you don't know, admit it in character
7. Advance story threads subtly through dialogue

Respond naturally as this character. You can include actions in *asterisks*.
Keep responses to 1-3 sentences unless the topic requires more depth.`;
  }

  private inferEmotion(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('laugh') || lower.includes('smile') || lower.includes('happy')) return 'happy';
    if (lower.includes('worry') || lower.includes('concern') || lower.includes('careful')) return 'concerned';
    if (lower.includes('curious') || lower.includes('interest') || lower.includes('wonder')) return 'curious';
    if (lower.includes('sad') || lower.includes('sigh') || lower.includes('unfortunately')) return 'sad';
    return 'neutral';
  }

  /**
   * Decide NPC autonomous actions based on world state
   */
  async decideNPCAction(
    npc: NPCState,
    nearbyPlayers: PlayerState[],
    worldContext: WorldContext
  ): Promise<NPCActionDecision> {
    // Simple decision tree for autonomous behavior
    // In production, this could also use AI for more dynamic decisions

    const hasNearbyPlayer = nearbyPlayers.length > 0;
    const closestPlayer = nearbyPlayers[0];

    // Priority: Engage with players nearby
    if (hasNearbyPlayer && npc.currentAction !== 'talking') {
      const distance = this.getDistance(npc.position, closestPlayer.position);

      if (distance < 5) {
        // Very close - face the player
        return {
          action: 'face_player',
          targetPosition: closestPlayer.position,
          animation: 'idle',
          interruptible: true,
        };
      } else if (distance < 15) {
        // Somewhat close - occasionally look at player
        if (Math.random() < 0.3) {
          return {
            action: 'glance',
            targetPosition: closestPlayer.position,
            animation: 'idle',
            interruptible: true,
          };
        }
      }
    }

    // Default behaviors based on archetype
    const behaviors = NPC_BEHAVIORS[npc.archetype || 'wanderer'];
    const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];

    return {
      action: behavior.action,
      targetPosition: behavior.movement
        ? this.getRandomNearbyPosition(npc.position, behavior.range || 5)
        : undefined,
      animation: behavior.animation,
      duration: behavior.duration,
      interruptible: true,
    };
  }

  private getDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
  }

  private getRandomNearbyPosition(
    current: { x: number; y: number; z: number },
    range: number
  ): { x: number; y: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * range;
    return {
      x: current.x + Math.cos(angle) * distance,
      y: current.y,
      z: current.z + Math.sin(angle) * distance,
    };
  }

  /**
   * Generate world event narration
   */
  async narrateWorldEvent(event: WorldEventInput): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: `You are the narrator of Genesis World. Describe events in second person, present tense, with an air of mystery. Be concise but evocative. One to two sentences maximum.`,
      messages: [
        {
          role: 'user',
          content: `Narrate this event: ${event.type} - ${event.description}
Context: ${event.context}
Affected area: ${event.location}`,
        },
      ],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : 'Something stirs in the world...';
  }
}

// Types - exported for external use
export interface NPCDialogueContext {
  relationship: number;
  previousInteractions: { topics: string[]; timestamp: number }[];
  secrets: string[];
  activeNarratives: { name: string; hints: string[] }[];
  conversationHistory: { playerText: string; npcResponse: string }[];
}

export interface NPCDialogueResponse {
  text: string;
  emotion: string;
  action: string | null;
  revealedInfo?: string;
}

export interface WorldContext {
  timeOfDay: 'day' | 'dusk' | 'night' | 'dawn';
  weather: string;
  recentEvents: string[];
}

export interface NPCActionDecision {
  action: string;
  targetPosition?: { x: number; y: number; z: number };
  animation: string;
  duration?: number;
  interruptible: boolean;
}

export interface WorldEventInput {
  type: string;
  description: string;
  context: string;
  location: string;
}

// NPC Personality definitions
const NPC_PERSONALITIES: Record<string, { core: string; speechPatterns: string }> = {
  sage: {
    core: `You are an ancient keeper of knowledge. You speak in riddles and rarely give direct answers. You know great secrets about this world but reveal them only to those who prove worthy. You are patient, wise, but carry a deep sadness about something in the past.`,
    speechPatterns: `
- Speak formally but not archaically
- Often answer questions with questions
- Reference "the old ways" or "before the breaking"
- Pause thoughtfully (show with "...")
- Use metaphors involving light, dreams, and memory`,
  },
  wanderer: {
    core: `You are a friendly traveler who has seen many places. You love stories and trading tales. You seem carefree but occasionally hint at a complicated past you've chosen to forget. You're helpful and warm, but change the subject when asked about your origins.`,
    speechPatterns: `
- Casual, friendly tone
- Use travel metaphors ("the road teaches us...")
- Tell short anecdotes from your travels
- Laugh easily, deflect serious questions
- Occasionally trail off when remembering something`,
  },
  guard: {
    core: `You are a protector of this place. You take your duty seriously but aren't unfriendly. You know the dangers of the world and try to warn travelers without scaring them. You respect those who show bravery and wisdom.`,
    speechPatterns: `
- Direct and practical
- Give warnings and advice
- Speak of duty and honor
- Assess others quickly
- Respect shown through brief nods and acknowledgments`,
  },
  merchant: {
    core: `You are a trader who deals in unusual goods and information. You're shrewd but fair, and you know that reputation matters. You have connections everywhere and hear many rumors. Everything has a price, but not always gold.`,
    speechPatterns: `
- Business-minded but personable
- Quote prices and make offers
- Share rumors as conversation
- "I've heard tell that..."
- Value reciprocity in information`,
  },
  quest_giver: {
    core: `You have problems that need solving and are willing to reward those who help. You're desperate enough to trust strangers but cautious enough to test them first. You represent the common people affected by the world's mysteries.`,
    speechPatterns: `
- Start with your problem
- Offer rewards clearly
- Express genuine gratitude or concern
- Ask about the player's capabilities
- Reference how things "used to be better"`,
  },
  mysterious: {
    core: `You are an enigma. Your motivations are unclear, your knowledge seems impossible, and you appear and disappear without explanation. You know things about players they haven't shared. Are you friend or foe? Even you may not know.`,
    speechPatterns: `
- Cryptic and indirect
- Know things you shouldn't
- Speak in possibilities, not certainties
- Rarely answer direct questions
- Leave conversations abruptly`,
  },
};

// NPC Behavior patterns
const NPC_BEHAVIORS: Record<string, { action: string; animation: string; movement?: boolean; range?: number; duration?: number }[]> = {
  sage: [
    { action: 'meditate', animation: 'sitting', duration: 30000 },
    { action: 'study', animation: 'reading', duration: 20000 },
    { action: 'observe_crystal', animation: 'looking_up', duration: 15000 },
    { action: 'pace', animation: 'walking_slow', movement: true, range: 3, duration: 10000 },
  ],
  wanderer: [
    { action: 'stretch', animation: 'stretching', duration: 5000 },
    { action: 'look_around', animation: 'looking_around', duration: 8000 },
    { action: 'wander', animation: 'walking', movement: true, range: 10, duration: 15000 },
    { action: 'rest', animation: 'sitting', duration: 20000 },
  ],
  guard: [
    { action: 'patrol', animation: 'walking', movement: true, range: 8, duration: 20000 },
    { action: 'stand_watch', animation: 'standing', duration: 15000 },
    { action: 'scan_horizon', animation: 'looking_around', duration: 10000 },
  ],
  merchant: [
    { action: 'arrange_goods', animation: 'working', duration: 15000 },
    { action: 'count_inventory', animation: 'thinking', duration: 10000 },
    { action: 'beckon', animation: 'waving', duration: 5000 },
  ],
  quest_giver: [
    { action: 'worry', animation: 'anxious', duration: 10000 },
    { action: 'pace', animation: 'walking_slow', movement: true, range: 3, duration: 15000 },
    { action: 'wait', animation: 'standing', duration: 20000 },
  ],
  mysterious: [
    { action: 'observe', animation: 'standing', duration: 30000 },
    { action: 'vanish_preparation', animation: 'fading', duration: 5000 },
  ],
};
