import { WorldRenderer } from './engine/renderer';
import { PlayerControls } from './engine/controls';
import { AudioManager } from './engine/audio';
import { SocketClient } from './network/socket';
import { WorldSync } from './network/sync';
import { UIManager } from './ui/manager';
import {
  NPCDialogueSystem,
  NPC_PERSONALITIES,
  type NPCPersonality,
} from './game/npc-dialogue';
import { SPAWN_POSITION, NPC_INTERACTION_DISTANCE } from '@genesis/shared';
import type { NPCState } from '@genesis/shared';

// Global state
let renderer: WorldRenderer;
let controls: PlayerControls;
let audioManager: AudioManager;
let socketClient: SocketClient;
let worldSync: WorldSync | null = null;
let uiManager: UIManager;
let dialogueSystem: NPCDialogueSystem;

// NPC state
let spawnNPCs: NPCState[] = [];
let nearestNPC: NPCState | null = null;
let isInConversation = false;

// Timing
let lastTime = 0;
let audioStarted = false;

async function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  // Initialize UI manager first for loading updates
  uiManager = new UIManager();
  uiManager.setLoadingProgress(10, 'Initializing Genesis World...');

  try {
    // Initialize renderer
    renderer = new WorldRenderer();
    await renderer.initialize(canvas);
    uiManager.setLoadingProgress(30, 'Preparing controls...');

    // Initialize controls
    controls = new PlayerControls(renderer.getCamera(), canvas);
    controls.setPosition(SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z);
    uiManager.setLoadingProgress(40, 'Setting up audio...');

    // Initialize audio (but don't start ambient yet - need user interaction)
    audioManager = new AudioManager(renderer.getCamera());
    await audioManager.initialize();
    uiManager.setLoadingProgress(50, 'Connecting to world...');

    // Initialize socket connection
    socketClient = new SocketClient();
    await socketClient.connect();
    uiManager.setLoadingProgress(60, 'Synchronizing state...');

    // Initialize world sync (Yjs)
    const playerId = socketClient.getPlayerId();
    const playerName = `Traveler_${playerId.slice(0, 4)}`;
    worldSync = new WorldSync('genesis-world-main', playerId, playerName);

    // Set up sync callbacks
    worldSync.onUpdate(() => {
      updateOtherPlayers();
      updateNPCs();
    });

    uiManager.setLoadingProgress(80, 'Generating world...');

    // Load spawn area
    await renderer.loadSpawnArea();

    // Create spawn NPCs
    createSpawnNPCs();

    // Initialize dialogue system
    dialogueSystem = new NPCDialogueSystem();
    dialogueSystem.onMessage((msg) => {
      if (msg.speaker === 'npc') {
        audioManager.playSFX('message');
      }
      uiManager.addDialogueMessage(msg.speaker, msg.text);
    });

    // Set up UI callbacks
    setupUICallbacks();

    uiManager.setLoadingProgress(100, 'Welcome to Genesis World');

    // Hide loading screen after brief delay
    setTimeout(() => {
      uiManager.hideLoadingScreen();
      uiManager.showWelcomeMessage();
      requestAnimationFrame(gameLoop);
    }, 800);
  } catch (error) {
    console.error('Initialization failed:', error);
    uiManager.setLoadingProgress(0, `Error: ${(error as Error).message}`);
  }
}

function createSpawnNPCs() {
  // Create Sage Elara near the ruins
  spawnNPCs.push({
    id: 'npc_sage_elara',
    name: 'Sage Elara',
    position: { x: 5, y: 0, z: 20 },
    rotation: -Math.PI / 4,
    currentAction: 'idle',
    mood: 'neutral',
    archetype: 'sage',
  });

  // Create Finn the Wanderer near a tree
  spawnNPCs.push({
    id: 'npc_wanderer_finn',
    name: 'Finn',
    position: { x: -15, y: 0, z: 8 },
    rotation: Math.PI / 3,
    currentAction: 'idle',
    mood: 'neutral',
    archetype: 'wanderer',
  });

  // Update renderer with NPCs
  renderer.updateNPCs(spawnNPCs);
}

function setupUICallbacks() {
  // Handle dialogue input
  uiManager.onDialogueSend((text) => {
    if (!isInConversation || !nearestNPC) return;

    const personality = getNPCPersonality(nearestNPC);
    if (personality) {
      dialogueSystem.sendMessage(text, personality);
    }
  });

  // Handle dialogue close
  uiManager.onDialogueClose(() => {
    endConversation();
  });
}

function getNPCPersonality(npc: NPCState): NPCPersonality | null {
  if (npc.id === 'npc_sage_elara') {
    return NPC_PERSONALITIES.sage_elara;
  } else if (npc.id === 'npc_wanderer_finn') {
    return NPC_PERSONALITIES.wanderer_finn;
  }
  return null;
}

function gameLoop(time: number) {
  requestAnimationFrame(gameLoop);

  const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  // Start audio on first frame after user interaction
  if (!audioStarted && controls.isPointerLocked()) {
    audioManager.resume();
    audioManager.startAmbience();
    audioStarted = true;
  }

  // Update controls (unless in dialogue)
  if (!isInConversation) {
    controls.update(deltaTime);
  }

  // Sync local player state
  if (worldSync) {
    const position = controls.getPosition();
    const rotation = controls.getRotation();
    worldSync.updateLocalPlayer(position, rotation);
  }

  // Check for nearby NPCs
  checkNPCProximity();

  // Handle interaction key
  handleInteraction();

  // Update audio listener position
  audioManager.updateListener(controls.getPosition(), controls.getDirection());

  // Render
  renderer.render();

  // Update UI
  uiManager.update(controls.isPointerLocked(), {
    position: controls.getPosition(),
    nearestNPC: nearestNPC?.name || null,
    canInteract: nearestNPC !== null && !isInConversation,
  });
}

function checkNPCProximity() {
  const playerPos = controls.getPosition();
  let closest: NPCState | null = null;
  let closestDist = NPC_INTERACTION_DISTANCE;

  for (const npc of spawnNPCs) {
    const dx = npc.position.x - playerPos.x;
    const dz = npc.position.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < closestDist) {
      closestDist = dist;
      closest = npc;
    }
  }

  // Update nearest NPC
  if (closest !== nearestNPC) {
    nearestNPC = closest;
    if (closest && !isInConversation) {
      uiManager.showInteractionPrompt(closest.name);
    } else if (!closest) {
      uiManager.hideInteractionPrompt();
    }
  }
}

function handleInteraction() {
  // E key to interact
  if (uiManager.wasInteractPressed()) {
    if (nearestNPC && !isInConversation) {
      startConversation(nearestNPC);
    }
  }

  // Escape to end conversation
  if (uiManager.wasEscapePressed() && isInConversation) {
    endConversation();
  }
}

function startConversation(npc: NPCState) {
  const personality = getNPCPersonality(npc);
  if (!personality) return;

  isInConversation = true;
  controls.unlock();
  audioManager.playSFX('interact');

  // Get suggested questions
  const suggestions = dialogueSystem.getSuggestedQuestions(personality);

  // Start dialogue
  dialogueSystem.startConversation(npc.id, personality);
  uiManager.showDialogue(npc.name, suggestions);

  console.log(`Started conversation with ${npc.name}`);
}

function endConversation() {
  if (!isInConversation) return;

  isInConversation = false;
  dialogueSystem.endConversation();
  uiManager.hideDialogue();
  audioManager.playSFX('whoosh');

  console.log('Ended conversation');
}

function updateOtherPlayers() {
  if (!worldSync) return;

  const otherPlayers = worldSync.getOtherPlayers();
  renderer.updateOtherPlayers(otherPlayers);

  // Update UI with player count
  uiManager.setPlayerCount(otherPlayers.length + 1);
}

function updateNPCs() {
  // For now, NPCs are static
  // In production, this would sync NPC state from server
  renderer.updateNPCs(spawnNPCs);
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Handle visibility change (pause when tab is hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audioManager?.suspend();
  } else {
    if (audioStarted) {
      audioManager?.resume();
    }
    lastTime = performance.now();
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  renderer?.handleResize();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  worldSync?.destroy();
  socketClient?.disconnect();
  audioManager?.dispose();
});
