export interface HUDState {
  fps: number;
  playerCount: number;
  chunkCount: number;
  position: { x: number; y: number; z: number };
}

export class HUD {
  private container: HTMLElement | null = null;
  private fpsElement: HTMLElement | null = null;
  private playerCountElement: HTMLElement | null = null;
  private positionElement: HTMLElement | null = null;

  private fpsHistory: number[] = [];
  private lastFrameTime = performance.now();
  private isDebugMode = false;

  constructor() {
    this.createHUD();
    this.setupDebugToggle();
  }

  private createHUD(): void {
    // Create HUD container
    this.container = document.createElement('div');
    this.container.id = 'hud';
    this.container.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.6);
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-size: 0.75rem;
      font-family: monospace;
      display: none;
      flex-direction: column;
      gap: 4px;
      min-width: 150px;
    `;

    // FPS counter
    this.fpsElement = document.createElement('div');
    this.fpsElement.textContent = 'FPS: --';

    // Player count
    this.playerCountElement = document.createElement('div');
    this.playerCountElement.textContent = 'Players: 1';

    // Position
    this.positionElement = document.createElement('div');
    this.positionElement.textContent = 'Pos: 0, 0, 0';

    this.container.appendChild(this.fpsElement);
    this.container.appendChild(this.playerCountElement);
    this.container.appendChild(this.positionElement);

    document.getElementById('ui-overlay')!.appendChild(this.container);
  }

  private setupDebugToggle(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        this.toggleDebugMode();
        e.preventDefault();
      }
    });
  }

  toggleDebugMode(): void {
    this.isDebugMode = !this.isDebugMode;
    if (this.container) {
      this.container.style.display = this.isDebugMode ? 'flex' : 'none';
    }
  }

  update(state: Partial<HUDState>): void {
    // Calculate FPS
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const currentFps = 1000 / deltaTime;
    this.fpsHistory.push(currentFps);
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }

    const avgFps = Math.round(
      this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
    );

    // Update elements
    if (this.fpsElement) {
      const fpsColor = avgFps >= 55 ? '#4ade80' : avgFps >= 30 ? '#fbbf24' : '#f87171';
      this.fpsElement.innerHTML = `FPS: <span style="color: ${fpsColor}">${avgFps}</span>`;
    }

    if (state.playerCount !== undefined && this.playerCountElement) {
      this.playerCountElement.textContent = `Players: ${state.playerCount}`;
    }

    if (state.position && this.positionElement) {
      const { x, y, z } = state.position;
      this.positionElement.textContent = `Pos: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
    }
  }

  getIsDebugMode(): boolean {
    return this.isDebugMode;
  }

  dispose(): void {
    this.container?.remove();
  }
}
