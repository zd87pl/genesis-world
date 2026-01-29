import { VOICE_SAMPLE_RATE, VOICE_CHUNK_SIZE } from '@genesis/shared';

export interface VoiceSessionCallbacks {
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onError: (error: Error) => void;
}

export class VoiceCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private isCapturing = false;
  private callbacks: VoiceSessionCallbacks | null = null;

  // Voice activity detection
  private silenceThreshold = 0.01;
  private silenceDelay = 1500; // ms
  private lastSpeechTime = 0;
  private isSpeaking = false;

  async start(callbacks: VoiceSessionCallbacks): Promise<void> {
    if (this.isCapturing) return;

    this.callbacks = callbacks;

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: VOICE_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: VOICE_SAMPLE_RATE,
      });

      // Create source from microphone
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for raw audio access
      // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
      this.processor = this.audioContext.createScriptProcessor(VOICE_CHUNK_SIZE, 1, 1);

      this.processor.onaudioprocess = this.handleAudioProcess.bind(this);

      // Connect nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isCapturing = true;
      console.log('Voice capture started');
    } catch (error) {
      callbacks.onError(error as Error);
      throw error;
    }
  }

  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (!this.callbacks || !this.isCapturing) return;

    const inputData = event.inputBuffer.getChannelData(0);

    // Calculate RMS for voice activity detection
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    const now = Date.now();

    // Voice activity detection
    if (rms > this.silenceThreshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.callbacks.onSpeechStart();
      }
      this.lastSpeechTime = now;
    } else if (this.isSpeaking && now - this.lastSpeechTime > this.silenceDelay) {
      this.isSpeaking = false;
      this.callbacks.onSpeechEnd();
    }

    // Only send audio when speaking
    if (this.isSpeaking) {
      // Convert Float32Array to Int16Array for transmission
      const int16Data = this.float32ToInt16(inputData);
      this.callbacks.onAudioChunk(int16Data.buffer as ArrayBuffer);
    }
  }

  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  stop(): void {
    if (!this.isCapturing) return;

    this.isCapturing = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.callbacks = null;
    console.log('Voice capture stopped');
  }

  getIsCapturing(): boolean {
    return this.isCapturing;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export class VoicePlayback {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor() {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  async queueAudio(audioData: ArrayBuffer, format: 'mp3' | 'pcm' = 'mp3'): Promise<void> {
    let buffer: AudioBuffer;

    if (format === 'mp3') {
      buffer = await this.audioContext.decodeAudioData(audioData.slice(0));
    } else {
      // PCM Int16
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
      }
      buffer = this.audioContext.createBuffer(1, float32Array.length, VOICE_SAMPLE_RATE);
      buffer.copyToChannel(float32Array, 0);
    }

    this.audioQueue.push(buffer);

    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.audioQueue.shift()!;

    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.gainNode);

    this.currentSource.onended = () => {
      this.playNext();
    };

    this.currentSource.start();
  }

  setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  stop(): void {
    this.audioQueue = [];
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  dispose(): void {
    this.stop();
    this.audioContext.close();
  }
}
