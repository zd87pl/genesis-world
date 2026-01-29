import type { ConversationMessage } from '../types';

export class ChatUI {
  private container: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private isOpen = false;

  private onSendMessage: ((text: string) => void) | null = null;

  constructor() {
    this.createChatUI();
    this.setupEventListeners();
  }

  private createChatUI(): void {
    // Create chat container
    this.container = document.createElement('div');
    this.container.id = 'chat-container';
    this.container.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 20px;
      width: 400px;
      max-height: 300px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 8px;
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // Messages container
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.id = 'chat-messages';
    this.messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 220px;
    `;

    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    `;

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Type a message...';
    this.input.style.cssText = `
      width: 100%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      color: white;
      font-size: 0.875rem;
      outline: none;
    `;

    inputContainer.appendChild(this.input);
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(inputContainer);

    document.getElementById('ui-overlay')!.appendChild(this.container);
  }

  private setupEventListeners(): void {
    // Enter to send
    this.input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.input?.value.trim()) {
        this.sendMessage(this.input.value.trim());
        this.input.value = '';
      }

      // Prevent game controls while typing
      e.stopPropagation();
    });

    // Global key to toggle chat
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.isOpen) {
        this.open();
        e.preventDefault();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private sendMessage(text: string): void {
    if (this.onSendMessage) {
      this.onSendMessage(text);
    }
  }

  addMessage(message: ConversationMessage): void {
    if (!this.messagesContainer) return;

    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
      padding: 8px 12px;
      border-radius: 4px;
      background: ${message.sender === 'player' ? 'rgba(74, 144, 217, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
      color: white;
      font-size: 0.875rem;
      align-self: ${message.sender === 'player' ? 'flex-end' : 'flex-start'};
      max-width: 80%;
      word-wrap: break-word;
    `;
    messageEl.textContent = message.text;

    this.messagesContainer.appendChild(messageEl);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  clearMessages(): void {
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
  }

  open(): void {
    if (this.container) {
      this.container.style.display = 'flex';
      this.input?.focus();
      this.isOpen = true;
    }
  }

  close(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.input?.blur();
      this.isOpen = false;
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setOnSendMessage(callback: (text: string) => void): void {
    this.onSendMessage = callback;
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  dispose(): void {
    this.container?.remove();
  }
}
