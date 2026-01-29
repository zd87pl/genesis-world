import { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PlayerState,
  Vector3,
  Quaternion,
  NPCMood,
} from '@genesis/shared';
import { WorldStateManager } from '../services/sync/state-manager.js';
import { NPCManager } from '../services/npc/manager.js';
import { GameMasterOrchestrator } from '../services/game-master/orchestrator.js';
import { SPAWN_POSITION, NPC_INTERACTION_DISTANCE } from '@genesis/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(
  io: TypedIO,
  worldState: WorldStateManager,
  npcManager: NPCManager,
  gameMaster: GameMasterOrchestrator
) {
  io.on('connection', (socket: TypedSocket) => {
    const playerId = socket.handshake.auth.playerId || socket.id;
    console.log(`Player connected: ${playerId}`);

    // Initialize player state
    const playerState: PlayerState = {
      id: playerId,
      name: `Player_${playerId.slice(0, 6)}`,
      position: { ...SPAWN_POSITION },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      lastUpdate: Date.now(),
    };

    worldState.addPlayer(playerState);

    // Notify other players
    socket.broadcast.emit('player:joined', playerState);

    // Send existing players to new player
    const existingPlayers = worldState.getPlayers();
    for (const player of existingPlayers) {
      if (player.id !== playerId) {
        socket.emit('player:joined', player);
      }
    }

    // Send existing NPCs
    const npcs = worldState.getNPCs();
    for (const npc of npcs) {
      socket.emit('npc:updated', npc);
    }

    // Send spawn chunk data
    const spawnChunk = worldState.getChunk('0,0');
    if (spawnChunk) {
      socket.emit('chunk:ready', spawnChunk);
    }

    // Handle player position updates
    socket.on('player:update', (data: { position: Vector3; rotation: Quaternion }) => {
      const player = worldState.getPlayer(playerId);
      if (!player) return;

      const updatedPlayer: PlayerState = {
        ...player,
        position: data.position,
        rotation: data.rotation,
        lastUpdate: Date.now(),
      };

      worldState.updatePlayer(updatedPlayer);

      // Broadcast to other players (throttled in client)
      socket.broadcast.emit('player:updated', updatedPlayer);

      // Check for chunk loading needs
      gameMaster.checkPlayerPosition(updatedPlayer);
    });

    // Handle player interactions
    socket.on('player:interact', (data: { targetId: string; action: string }) => {
      console.log(`Player ${playerId} interacted with ${data.targetId}: ${data.action}`);

      // Check if target is an NPC
      const npc = worldState.getNPC(data.targetId);
      if (npc) {
        const player = worldState.getPlayer(playerId);
        if (player) {
          const distance = calculateDistance(player.position, npc.position);
          if (distance <= NPC_INTERACTION_DISTANCE) {
            npcManager.handleInteraction(npc.id, playerId, data.action);
          }
        }
      }
    });

    // Handle NPC conversation start
    socket.on('npc:startConversation', (npcId: string) => {
      const npc = worldState.getNPC(npcId);
      const player = worldState.getPlayer(playerId);

      if (!npc || !player) return;

      const distance = calculateDistance(player.position, npc.position);
      if (distance > NPC_INTERACTION_DISTANCE) {
        socket.emit('error', {
          code: 'TOO_FAR',
          message: 'You are too far from the NPC',
        });
        return;
      }

      npcManager.startConversation(npcId, playerId, (text, emotion) => {
        socket.emit('npc:speak', { npcId, text });

        // Update NPC state
        const updatedNpc = worldState.getNPC(npcId);
        if (updatedNpc) {
          updatedNpc.currentAction = 'talking';
          updatedNpc.targetPlayerId = playerId;
          updatedNpc.mood = toValidMood(emotion);
          worldState.updateNPC(updatedNpc);
          io.emit('npc:updated', updatedNpc);
        }
      });
    });

    // Handle NPC message - uses AI-driven dialogue when available
    socket.on('npc:message', async (data: { npcId: string; text: string }) => {
      // Try AI-driven dialogue first
      const aiStatus = gameMaster.getAIStatus();

      if (aiStatus.enabled) {
        try {
          const response = await gameMaster.generateNPCDialogue(
            playerId,
            data.npcId,
            data.text
          );

          socket.emit('npc:speak', {
            npcId: data.npcId,
            text: response.text,
          });

          // Update NPC mood based on response emotion
          const npc = worldState.getNPC(data.npcId);
          if (npc && response.emotion) {
            npc.mood = toValidMood(response.emotion);
            worldState.updateNPC(npc);
            io.emit('npc:updated', npc);
          }

          return;
        } catch (error) {
          console.error('AI dialogue failed, falling back:', error);
        }
      }

      // Fallback to basic NPC manager
      npcManager.sendMessage(data.npcId, playerId, data.text);
    });

    // Handle NPC conversation end
    socket.on('npc:endConversation', (npcId: string) => {
      npcManager.endConversation(npcId, playerId);

      const npc = worldState.getNPC(npcId);
      if (npc) {
        npc.currentAction = 'idle';
        npc.targetPlayerId = undefined;
        worldState.updateNPC(npc);
        io.emit('npc:updated', npc);
      }
    });

    // Handle chunk requests
    socket.on('chunk:request', (chunkId: string) => {
      const chunk = worldState.getChunk(chunkId);
      if (chunk) {
        socket.emit('chunk:ready', chunk);
      } else {
        socket.emit('chunk:generating', chunkId);
        gameMaster.requestChunkGeneration(chunkId, playerId).catch((error) => {
          console.error(`Failed to generate chunk ${chunkId}:`, error);
          socket.emit('error', {
            code: 'CHUNK_GENERATION_FAILED',
            message: `Failed to generate chunk ${chunkId}`,
          });
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Player disconnected: ${playerId} (${reason})`);

      // End any active conversations
      npcManager.handlePlayerDisconnect(playerId);

      // Remove player from world state
      worldState.removePlayer(playerId);

      // Notify other players
      socket.broadcast.emit('player:left', playerId);
    });
  });
}

function calculateDistance(a: Vector3, b: Vector3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const VALID_MOODS: NPCMood[] = ['neutral', 'happy', 'curious', 'concerned'];

function toValidMood(emotion: string): NPCMood {
  const moodMap: Record<string, NPCMood> = {
    happy: 'happy',
    sad: 'concerned',
    curious: 'curious',
    concerned: 'concerned',
    neutral: 'neutral',
    friendly: 'happy',
    thoughtful: 'curious',
  };
  const mapped = moodMap[emotion];
  if (mapped && VALID_MOODS.includes(mapped)) {
    return mapped;
  }
  return 'neutral';
}
