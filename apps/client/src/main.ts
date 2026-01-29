import { WorldRenderer } from './engine/renderer';
import { PlayerControls } from './engine/controls';
import { AudioManager } from './engine/audio';
import { SocketClient } from './network/socket';
import { WorldSync } from './network/sync';
import { UIManager } from './ui/manager';
import { SPAWN_POSITION } from '@genesis/shared';

// Global state
let renderer: WorldRenderer;
let controls: PlayerControls;
let audioManager: AudioManager;
let socketClient: SocketClient;
let worldSync: WorldSync | null = null;
let uiManager: UIManager;

// Timing
let lastTime = 0;

async function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  // Initialize UI manager first for loading updates
  uiManager = new UIManager();
  uiManager.setLoadingProgress(10, 'Initializing renderer...');

  try {
    // Initialize renderer
    renderer = new WorldRenderer();
    await renderer.initialize(canvas);
    uiManager.setLoadingProgress(30, 'Setting up controls...');

    // Initialize controls
    controls = new PlayerControls(renderer.getCamera(), canvas);
    controls.setPosition(SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z);
    uiManager.setLoadingProgress(40, 'Initializing audio...');

    // Initialize audio
    audioManager = new AudioManager(renderer.getCamera());
    uiManager.setLoadingProgress(50, 'Connecting to server...');

    // Initialize socket connection
    socketClient = new SocketClient();
    await socketClient.connect();
    uiManager.setLoadingProgress(70, 'Loading world...');

    // Initialize world sync (Yjs)
    const playerId = socketClient.getPlayerId();
    const playerName = `Player_${playerId.slice(0, 6)}`;
    worldSync = new WorldSync('genesis-world-main', playerId, playerName);

    // Set up sync callbacks
    worldSync.onUpdate(() => {
      updateOtherPlayers();
    });

    uiManager.setLoadingProgress(90, 'Loading spawn area...');

    // Load spawn area
    await renderer.loadSpawnArea();

    uiManager.setLoadingProgress(100, 'Ready!');

    // Hide loading screen
    setTimeout(() => {
      uiManager.hideLoadingScreen();
      // Start game loop
      requestAnimationFrame(gameLoop);
    }, 500);
  } catch (error) {
    console.error('Initialization failed:', error);
    uiManager.setLoadingProgress(0, `Error: ${(error as Error).message}`);
  }
}

function gameLoop(time: number) {
  requestAnimationFrame(gameLoop);

  const deltaTime = Math.min((time - lastTime) / 1000, 0.1); // Cap at 100ms
  lastTime = time;

  // Update controls
  controls.update(deltaTime);

  // Sync local player state
  if (worldSync) {
    const position = controls.getPosition();
    const rotation = controls.getRotation();
    worldSync.updateLocalPlayer(position, rotation);
  }

  // Update audio listener position
  audioManager.updateListener(
    controls.getPosition(),
    controls.getDirection()
  );

  // Render
  renderer.render();

  // Update UI
  uiManager.update(controls.isPointerLocked());
}

function updateOtherPlayers() {
  if (!worldSync) return;

  const otherPlayers = worldSync.getOtherPlayers();
  renderer.updateOtherPlayers(otherPlayers);
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
    // Pause audio, etc.
    audioManager?.suspend();
  } else {
    audioManager?.resume();
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
});
