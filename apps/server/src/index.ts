import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { setupSocketHandlers } from './ws/handlers.js';
import { authRoutes } from './routes/auth.js';
import { worldRoutes } from './routes/world.js';
import { assetRoutes } from './routes/assets.js';
import { GameMasterOrchestrator } from './services/game-master/orchestrator.js';
import { WorldStateManager } from './services/sync/state-manager.js';
import { NPCManager } from './services/npc/manager.js';

async function main() {
  // Create Fastify instance with conditional pretty logging
  const isDev = process.env.NODE_ENV !== 'production';

  const fastify = Fastify({
    logger: isDev
      ? {
          level: config.logLevel,
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : { level: config.logLevel },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.clientUrl,
    credentials: true,
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(worldRoutes, { prefix: '/api/world' });
  await fastify.register(assetRoutes, { prefix: '/api/assets' });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Create Socket.IO server
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // Initialize services
  const worldState = new WorldStateManager();
  const npcManager = new NPCManager(worldState);
  const gameMaster = new GameMasterOrchestrator(worldState, npcManager);

  // Setup socket handlers
  setupSocketHandlers(io, worldState, npcManager, gameMaster);

  // Start game master tick
  gameMaster.start();

  // Start server
  try {
    await fastify.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Socket.IO ready on ws://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    gameMaster.stop();
    io.close();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
