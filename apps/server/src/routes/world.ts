import { FastifyInstance } from 'fastify';
import type { WorldChunk, WorldSession } from '@genesis/shared';

// In-memory storage for PoC
const sessions: Map<string, WorldSession> = new Map();

export async function worldRoutes(fastify: FastifyInstance) {
  // Get available world sessions
  fastify.get('/sessions', async () => {
    const sessionList = Array.from(sessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      playerCount: s.players.length,
      maxPlayers: s.maxPlayers,
    }));

    return {
      success: true,
      data: sessionList,
    };
  });

  // Create new world session
  fastify.post('/sessions', async (request) => {
    const body = request.body as { name?: string; maxPlayers?: number };

    const sessionId = `world_${Date.now()}`;
    const session: WorldSession = {
      id: sessionId,
      name: body.name || `World ${sessions.size + 1}`,
      ownerId: 'system', // Would be from JWT in production
      players: [],
      maxPlayers: body.maxPlayers || 10,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    sessions.set(sessionId, session);

    return {
      success: true,
      data: session,
    };
  });

  // Get session details
  fastify.get('/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = sessions.get(sessionId);

    if (!session) {
      reply.status(404);
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      };
    }

    return {
      success: true,
      data: session,
    };
  });

  // Join session
  fastify.post('/sessions/:sessionId/join', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { playerId: string };

    const session = sessions.get(sessionId);

    if (!session) {
      reply.status(404);
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      };
    }

    if (session.players.length >= session.maxPlayers) {
      reply.status(400);
      return {
        success: false,
        error: { code: 'SESSION_FULL', message: 'Session is full' },
      };
    }

    if (!session.players.includes(body.playerId)) {
      session.players.push(body.playerId);
      session.lastActivity = new Date();
    }

    return {
      success: true,
      data: { joined: true, session },
    };
  });

  // Leave session
  fastify.post('/sessions/:sessionId/leave', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { playerId: string };

    const session = sessions.get(sessionId);

    if (!session) {
      reply.status(404);
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      };
    }

    session.players = session.players.filter((p) => p !== body.playerId);
    session.lastActivity = new Date();

    return {
      success: true,
      data: { left: true },
    };
  });

  // Get world state (chunks, NPCs)
  fastify.get('/state', async () => {
    // In production, this would come from database/Redis
    // For PoC, return initial spawn area

    const spawnChunk: WorldChunk = {
      id: '0,0',
      status: 'ready',
      npcs: ['npc_guide'],
      pointsOfInterest: [
        {
          id: 'poi_spawn_crystal',
          type: 'landmark',
          name: 'Genesis Crystal',
          description: 'A mysterious glowing crystal that marks the center of the world.',
          position: { x: 0, y: 3, z: 10 },
          discovered: true,
        },
      ],
      biome: 'plains',
      generatedAt: Date.now(),
    };

    return {
      success: true,
      data: {
        chunks: [spawnChunk],
        npcs: [
          {
            id: 'npc_guide',
            name: 'Elder Sage',
            position: { x: 5, y: 0, z: 8 },
            rotation: 0,
            currentAction: 'idle',
            mood: 'neutral',
            archetype: 'quest_giver',
          },
        ],
      },
    };
  });
}
