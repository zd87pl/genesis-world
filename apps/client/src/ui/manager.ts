import type { Vector3 } from '@genesis/shared';

interface UpdateState {
  position: Vector3;
  nearestNPC: string | null;
  canInteract: boolean;
}

export class UIManager {
  private loadingScreen: HTMLElement;
  private progressFill: HTMLElement;
  private loadingStatus: HTMLElement;
  private instructions: HTMLElement;

  // Dialogue UI
  private dialogueContainer: HTMLElement | null = null;
  private dialogueMessages: HTMLElement | null = null;
  private dialogueInput: HTMLInputElement | null = null;
  private dialogueSuggestions: HTMLElement | null = null;

  // HUD
  private hudContainer: HTMLElement | null = null;
  private crosshair: HTMLElement | null = null;
  private interactionPrompt: HTMLElement | null = null;

  // Callbacks
  private onDialogueSendCallback: ((text: string) => void) | null = null;
  private onDialogueCloseCallback: (() => void) | null = null;

  // Input state
  private interactPressed = false;
  private escapePressed = false;

  constructor() {
    this.loadingScreen = document.getElementById('loading-screen')!;
    this.progressFill = document.getElementById('progress-fill')!;
    this.loadingStatus = document.getElementById('loading-status')!;
    this.instructions = document.getElementById('instructions')!;

    this.createHUD();
    this.createDialogueUI();
    this.setupKeyListeners();
  }

  private createHUD(): void {
    const overlay = document.getElementById('ui-overlay')!;

    // Crosshair
    this.crosshair = document.createElement('div');
    this.crosshair.id = 'crosshair';
    this.crosshair.innerHTML = `
      <div style="width: 20px; height: 2px; background: rgba(255,255,255,0.7); position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></div>
      <div style="width: 2px; height: 20px; background: rgba(255,255,255,0.7); position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);"></div>
    `;
    this.crosshair.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    overlay.appendChild(this.crosshair);

    // Interaction prompt
    this.interactionPrompt = document.createElement('div');
    this.interactionPrompt.id = 'interaction-prompt';
    this.interactionPrompt.style.cssText = `
      position: absolute;
      bottom: 180px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(20,20,40,0.9));
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 0.9rem;
      border: 1px solid rgba(100, 150, 255, 0.4);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      display: none;
      text-align: center;
    `;
    overlay.appendChild(this.interactionPrompt);

    // HUD container (top-left)
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'hud';
    this.hudContainer.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0,0,0,0.5);
      color: white;
      padding: 10px 14px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.75rem;
      display: none;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
    `;
    this.hudContainer.innerHTML = `
      <div id="hud-players">Players: 1</div>
      <div id="hud-position">Pos: 0, 0</div>
    `;
    overlay.appendChild(this.hudContainer);
  }

  private createDialogueUI(): void {
    const overlay = document.getElementById('ui-overlay')!;

    this.dialogueContainer = document.createElement('div');
    this.dialogueContainer.id = 'dialogue-container';
    this.dialogueContainer.style.cssText = `
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      max-width: 90vw;
      background: linear-gradient(180deg, rgba(10,15,30,0.95), rgba(5,10,20,0.98));
      border-radius: 12px;
      border: 1px solid rgba(100, 150, 255, 0.3);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      background: rgba(50, 80, 150, 0.3);
      border-bottom: 1px solid rgba(100, 150, 255, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span id="dialogue-npc-name" style="font-weight: 600; color: #88bbff;">NPC Name</span>
      <button id="dialogue-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 1.2rem; padding: 0 4px;">&times;</button>
    `;
    this.dialogueContainer.appendChild(header);

    // Messages area
    this.dialogueMessages = document.createElement('div');
    this.dialogueMessages.id = 'dialogue-messages';
    this.dialogueMessages.style.cssText = `
      padding: 16px;
      max-height: 250px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    this.dialogueContainer.appendChild(this.dialogueMessages);

    // Suggestions
    this.dialogueSuggestions = document.createElement('div');
    this.dialogueSuggestions.id = 'dialogue-suggestions';
    this.dialogueSuggestions.style.cssText = `
      padding: 8px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      border-top: 1px solid rgba(100, 150, 255, 0.1);
    `;
    this.dialogueContainer.appendChild(this.dialogueSuggestions);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid rgba(100, 150, 255, 0.2);
      display: flex;
      gap: 8px;
    `;

    this.dialogueInput = document.createElement('input');
    this.dialogueInput.type = 'text';
    this.dialogueInput.placeholder = 'Type a message...';
    this.dialogueInput.style.cssText = `
      flex: 1;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(100, 150, 255, 0.3);
      border-radius: 6px;
      padding: 10px 14px;
      color: white;
      font-size: 0.9rem;
      outline: none;
    `;

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    sendBtn.style.cssText = `
      background: linear-gradient(135deg, #4488ff, #3366dd);
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s;
    `;
    sendBtn.onmousedown = () => (sendBtn.style.transform = 'scale(0.95)');
    sendBtn.onmouseup = () => (sendBtn.style.transform = 'scale(1)');

    inputArea.appendChild(this.dialogueInput);
    inputArea.appendChild(sendBtn);
    this.dialogueContainer.appendChild(inputArea);

    overlay.appendChild(this.dialogueContainer);

    // Event listeners
    const closeBtn = this.dialogueContainer.querySelector('#dialogue-close')!;
    closeBtn.addEventListener('click', () => {
      this.onDialogueCloseCallback?.();
    });

    sendBtn.addEventListener('click', () => this.sendDialogueMessage());
    this.dialogueInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendDialogueMessage();
      }
    });
  }

  private sendDialogueMessage(): void {
    if (!this.dialogueInput) return;
    const text = this.dialogueInput.value.trim();
    if (!text) return;

    this.dialogueInput.value = '';
    this.onDialogueSendCallback?.(text);
  }

  private setupKeyListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        this.interactPressed = true;
      }
      if (e.code === 'Escape') {
        this.escapePressed = true;
      }
      if (e.code === 'F1') {
        this.toggleHUD();
        e.preventDefault();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'KeyE') {
        this.interactPressed = false;
      }
      if (e.code === 'Escape') {
        this.escapePressed = false;
      }
    });
  }

  private toggleHUD(): void {
    if (this.hudContainer) {
      const isVisible = this.hudContainer.style.display !== 'none';
      this.hudContainer.style.display = isVisible ? 'none' : 'flex';
    }
  }

  setLoadingProgress(percent: number, status: string): void {
    this.progressFill.style.width = `${percent}%`;
    this.loadingStatus.textContent = status;
  }

  hideLoadingScreen(): void {
    this.loadingScreen.style.opacity = '0';
    this.loadingScreen.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      this.loadingScreen.style.display = 'none';
    }, 500);
  }

  showLoadingScreen(): void {
    this.loadingScreen.style.display = 'flex';
    this.loadingScreen.style.opacity = '1';
  }

  showWelcomeMessage(): void {
    this.showMessage(
      'Welcome to Genesis World. Click to begin exploring.',
      5000
    );
  }

  update(isPointerLocked: boolean, state?: UpdateState): void {
    // Update instructions visibility
    if (isPointerLocked) {
      this.instructions.classList.add('hidden');
      if (this.crosshair) this.crosshair.style.opacity = '1';
    } else {
      this.instructions.classList.remove('hidden');
      if (this.crosshair) this.crosshair.style.opacity = '0';
    }

    // Update HUD
    if (state && this.hudContainer) {
      const posEl = this.hudContainer.querySelector('#hud-position');
      if (posEl) {
        posEl.textContent = `Pos: ${state.position.x.toFixed(0)}, ${state.position.z.toFixed(0)}`;
      }
    }
  }

  setPlayerCount(count: number): void {
    if (this.hudContainer) {
      const el = this.hudContainer.querySelector('#hud-players');
      if (el) {
        el.textContent = `Players: ${count}`;
      }
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
      background: linear-gradient(135deg, rgba(0,0,0,0.85), rgba(20,20,40,0.9));
      color: white;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 1rem;
      border: 1px solid rgba(100, 150, 255, 0.3);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 100;
      opacity: 0;
      transition: opacity 0.3s;
    `;

    const overlay = document.getElementById('ui-overlay')!;
    overlay.appendChild(messageEl);

    // Fade in
    requestAnimationFrame(() => {
      messageEl.style.opacity = '1';
    });

    // Fade out and remove
    setTimeout(() => {
      messageEl.style.opacity = '0';
      setTimeout(() => messageEl.remove(), 300);
    }, duration - 300);
  }

  showInteractionPrompt(npcName: string): void {
    if (!this.interactionPrompt) return;
    this.interactionPrompt.innerHTML = `
      <div style="margin-bottom: 4px; font-size: 1rem; color: #88bbff;">${npcName}</div>
      <div style="opacity: 0.8;">Press <span style="color: #ffdd88; font-weight: 600;">[E]</span> to talk</div>
    `;
    this.interactionPrompt.style.display = 'block';
  }

  hideInteractionPrompt(): void {
    if (this.interactionPrompt) {
      this.interactionPrompt.style.display = 'none';
    }
  }

  showDialogue(npcName: string, suggestions: string[]): void {
    if (!this.dialogueContainer || !this.dialogueMessages || !this.dialogueSuggestions)
      return;

    // Set NPC name
    const nameEl = this.dialogueContainer.querySelector('#dialogue-npc-name');
    if (nameEl) nameEl.textContent = npcName;

    // Clear messages
    this.dialogueMessages.innerHTML = '';

    // Add suggestions
    this.dialogueSuggestions.innerHTML = '';
    for (const suggestion of suggestions) {
      const btn = document.createElement('button');
      btn.textContent = suggestion;
      btn.style.cssText = `
        background: rgba(100, 150, 255, 0.2);
        border: 1px solid rgba(100, 150, 255, 0.3);
        border-radius: 16px;
        padding: 6px 12px;
        color: #aaccff;
        font-size: 0.8rem;
        cursor: pointer;
        transition: background 0.2s;
      `;
      btn.onmouseover = () => (btn.style.background = 'rgba(100, 150, 255, 0.4)');
      btn.onmouseout = () => (btn.style.background = 'rgba(100, 150, 255, 0.2)');
      btn.onclick = () => {
        if (this.dialogueInput) {
          this.dialogueInput.value = suggestion;
          this.sendDialogueMessage();
        }
      };
      this.dialogueSuggestions.appendChild(btn);
    }

    // Show container
    this.dialogueContainer.style.display = 'flex';
    this.hideInteractionPrompt();

    // Focus input
    setTimeout(() => {
      this.dialogueInput?.focus();
    }, 100);
  }

  hideDialogue(): void {
    if (this.dialogueContainer) {
      this.dialogueContainer.style.display = 'none';
    }
  }

  addDialogueMessage(speaker: 'player' | 'npc', text: string): void {
    if (!this.dialogueMessages) return;

    const msgEl = document.createElement('div');
    msgEl.style.cssText = `
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 0.9rem;
      line-height: 1.4;
      ${
        speaker === 'player'
          ? 'align-self: flex-end; background: linear-gradient(135deg, #4488ff, #3366dd); color: white;'
          : 'align-self: flex-start; background: rgba(255,255,255,0.1); color: #ddd;'
      }
    `;
    msgEl.textContent = text;

    this.dialogueMessages.appendChild(msgEl);
    this.dialogueMessages.scrollTop = this.dialogueMessages.scrollHeight;
  }

  onDialogueSend(callback: (text: string) => void): void {
    this.onDialogueSendCallback = callback;
  }

  onDialogueClose(callback: () => void): void {
    this.onDialogueCloseCallback = callback;
  }

  wasInteractPressed(): boolean {
    const pressed = this.interactPressed;
    this.interactPressed = false;
    return pressed;
  }

  wasEscapePressed(): boolean {
    const pressed = this.escapePressed;
    this.escapePressed = false;
    return pressed;
  }
}
