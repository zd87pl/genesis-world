export class UIManager {
  private loadingScreen: HTMLElement;
  private progressFill: HTMLElement;
  private loadingStatus: HTMLElement;
  private instructions: HTMLElement;

  constructor() {
    this.loadingScreen = document.getElementById('loading-screen')!;
    this.progressFill = document.getElementById('progress-fill')!;
    this.loadingStatus = document.getElementById('loading-status')!;
    this.instructions = document.getElementById('instructions')!;
  }

  setLoadingProgress(percent: number, status: string): void {
    this.progressFill.style.width = `${percent}%`;
    this.loadingStatus.textContent = status;
  }

  hideLoadingScreen(): void {
    this.loadingScreen.classList.add('hidden');
  }

  showLoadingScreen(): void {
    this.loadingScreen.classList.remove('hidden');
  }

  update(isPointerLocked: boolean): void {
    // Hide instructions when pointer is locked
    if (isPointerLocked) {
      this.instructions.classList.add('hidden');
    } else {
      this.instructions.classList.remove('hidden');
    }
  }

  showMessage(message: string, duration: number = 3000): void {
    const messageEl = document.createElement('div');
    messageEl.className = 'ui-message';
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: absolute;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1rem;
      animation: fadeInOut ${duration}ms ease-in-out;
      z-index: 100;
    `;

    const overlay = document.getElementById('ui-overlay')!;
    overlay.appendChild(messageEl);

    setTimeout(() => {
      messageEl.remove();
    }, duration);
  }

  showInteractionPrompt(text: string): void {
    let prompt = document.getElementById('interaction-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'interaction-prompt';
      prompt.style.cssText = `
        position: absolute;
        bottom: 150px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 0.875rem;
        border: 1px solid rgba(255, 255, 255, 0.2);
      `;
      document.getElementById('ui-overlay')!.appendChild(prompt);
    }
    prompt.textContent = text;
    prompt.style.display = 'block';
  }

  hideInteractionPrompt(): void {
    const prompt = document.getElementById('interaction-prompt');
    if (prompt) {
      prompt.style.display = 'none';
    }
  }
}
