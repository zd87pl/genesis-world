import * as THREE from 'three';

/**
 * Immersive audio system with synthesized ambient atmosphere
 * Creates a rich soundscape without requiring external audio files
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private listener: THREE.AudioListener;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private sounds: Map<string, THREE.PositionalAudio> = new Map();
  private ambientSounds: Map<string, THREE.Audio> = new Map();
  private isInitialized = false;

  // Ambient state
  private windGain: GainNode | null = null;
  private activeOscillators: OscillatorNode[] = [];

  constructor(camera: THREE.PerspectiveCamera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.context = new AudioContext();

      // Master gain
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.context.destination);

      // Ambient channel
      this.ambientGain = this.context.createGain();
      this.ambientGain.gain.value = 0.5;
      this.ambientGain.connect(this.masterGain);

      // SFX channel
      this.sfxGain = this.context.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.masterGain);

      this.isInitialized = true;
      console.log('Audio system initialized');
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Start the full ambient soundscape
   */
  startAmbience(): void {
    if (!this.context || !this.ambientGain) return;

    this.createWindSound();
    this.createForestAmbience();
    this.createCrystalHum();
  }

  private createWindSound(): void {
    if (!this.context || !this.ambientGain) return;

    // Brown noise for wind
    const bufferSize = 2 * this.context.sampleRate;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const windSource = this.context.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = this.context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;
    windFilter.Q.value = 1;

    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0.12;

    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ambientGain);

    windSource.start();
    this.modulateWind();
  }

  private modulateWind(): void {
    if (!this.windGain || !this.context) return;

    const modulate = () => {
      if (!this.windGain || !this.context) return;

      const now = this.context.currentTime;
      const duration = 3 + Math.random() * 4;
      const targetGain = 0.06 + Math.random() * 0.12;

      this.windGain.gain.linearRampToValueAtTime(targetGain, now + duration);
      setTimeout(modulate, duration * 1000);
    };

    modulate();
  }

  private createForestAmbience(): void {
    if (!this.context || !this.ambientGain) return;

    // Bird chirps
    const createBirdChirp = () => {
      if (!this.context || !this.ambientGain) return;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      const baseFreq = 1500 + Math.random() * 2000;
      osc.frequency.value = baseFreq;
      osc.type = 'sine';

      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.025, this.context.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.15);

      osc.frequency.linearRampToValueAtTime(
        baseFreq * (1 + Math.random() * 0.3),
        this.context.currentTime + 0.1
      );

      osc.connect(gain);
      gain.connect(this.ambientGain);

      osc.start();
      osc.stop(this.context.currentTime + 0.2);

      const delay = 3000 + Math.random() * 10000;
      setTimeout(createBirdChirp, delay);
    };

    for (let i = 0; i < 3; i++) {
      setTimeout(createBirdChirp, Math.random() * 5000);
    }

    // Rustling leaves
    const createRustle = () => {
      if (!this.context || !this.ambientGain) return;

      const bufferSize = Math.floor(0.3 * this.context.sampleRate);
      const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = this.context.createBufferSource();
      source.buffer = buffer;

      const filter = this.context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000 + Math.random() * 2000;
      filter.Q.value = 2;

      const gain = this.context.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.015, this.context.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.25);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain);

      source.start();

      setTimeout(createRustle, 2000 + Math.random() * 5000);
    };

    setTimeout(createRustle, 1000);
  }

  private createCrystalHum(): void {
    if (!this.context || !this.ambientGain) return;

    // Ethereal chord (A minor)
    const frequencies = [220, 277.18, 329.63, 440];

    frequencies.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = Math.random() * 10 - 5;

      gain.gain.value = 0.012 - i * 0.002;

      osc.connect(gain);
      gain.connect(this.ambientGain!);

      osc.start();
      this.activeOscillators.push(osc);

      // Volume LFO
      const lfo = this.context!.createOscillator();
      const lfoGain = this.context!.createGain();
      lfo.frequency.value = 0.1 + Math.random() * 0.1;
      lfoGain.gain.value = 0.004;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      this.activeOscillators.push(lfo);
    });
  }

  /**
   * Play a sound effect
   */
  playSFX(type: 'interact' | 'footstep' | 'discovery' | 'message' | 'whoosh'): void {
    if (!this.context || !this.sfxGain) return;

    switch (type) {
      case 'interact':
        this.playInteractSound();
        break;
      case 'footstep':
        this.playFootstep();
        break;
      case 'discovery':
        this.playDiscoverySound();
        break;
      case 'message':
        this.playMessageSound();
        break;
      case 'whoosh':
        this.playWhoosh();
        break;
    }
  }

  private playInteractSound(): void {
    if (!this.context || !this.sfxGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.value = 400;
    osc.frequency.linearRampToValueAtTime(800, this.context.currentTime + 0.15);

    gain.gain.value = 0.15;
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.context.currentTime + 0.2);
  }

  private playFootstep(): void {
    if (!this.context || !this.sfxGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.value = 80 + Math.random() * 40;
    osc.frequency.linearRampToValueAtTime(40, this.context.currentTime + 0.08);

    gain.gain.value = 0.1;
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.context.currentTime + 0.1);
  }

  private playDiscoverySound(): void {
    if (!this.context || !this.sfxGain) return;

    // Magical arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.context.currentTime;

    notes.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  private playMessageSound(): void {
    if (!this.context || !this.sfxGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.value = 880;

    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.context.currentTime + 0.4);
  }

  private playWhoosh(): void {
    if (!this.context || !this.sfxGain) return;

    const bufferSize = Math.floor(0.3 * this.context.sampleRate);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.frequency.linearRampToValueAtTime(200, this.context.currentTime + 0.2);
    filter.Q.value = 1;

    const gain = this.context.createGain();
    gain.gain.value = 0.15;
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.25);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start();
  }

  updateListener(position: THREE.Vector3, direction: THREE.Vector3): void {
    // Listener is attached to camera, updates automatically
  }

  async playPositionalSound(
    id: string,
    url: string,
    position: THREE.Vector3,
    options: {
      volume?: number;
      loop?: boolean;
      refDistance?: number;
      maxDistance?: number;
    } = {}
  ): Promise<void> {
    const {
      volume = 1,
      loop = false,
      refDistance = 1,
      maxDistance = 100,
    } = options;

    if (this.sounds.has(id)) return;

    try {
      const sound = new THREE.PositionalAudio(this.listener);
      const audioLoader = new THREE.AudioLoader();

      const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
        audioLoader.load(url, resolve, undefined, reject);
      });

      sound.setBuffer(buffer);
      sound.setVolume(volume);
      sound.setLoop(loop);
      sound.setRefDistance(refDistance);
      sound.setMaxDistance(maxDistance);
      sound.setDistanceModel('exponential');
      sound.position.copy(position);

      sound.play();
      this.sounds.set(id, sound);

      if (!loop) {
        sound.onEnded = () => {
          this.sounds.delete(id);
          sound.disconnect();
        };
      }
    } catch (error) {
      console.error(`Failed to play sound ${id}:`, error);
    }
  }

  stopSound(id: string): void {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.stop();
      sound.disconnect();
      this.sounds.delete(id);
    }

    const ambientSound = this.ambientSounds.get(id);
    if (ambientSound) {
      ambientSound.stop();
      ambientSound.disconnect();
      this.ambientSounds.delete(id);
    }
  }

  updateSoundPosition(id: string, position: THREE.Vector3): void {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.position.copy(position);
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMasterVolume(): number {
    return this.masterGain?.gain.value ?? 1;
  }

  suspend(): void {
    if (this.context?.state === 'running') {
      this.context.suspend();
    }
  }

  createBufferFromPCM(
    pcmData: Float32Array,
    sampleRate: number = 44100
  ): AudioBuffer | null {
    if (!this.context) return null;
    const buffer = this.context.createBuffer(1, pcmData.length, sampleRate);
    buffer.copyToChannel(pcmData, 0);
    return buffer;
  }

  playBuffer(buffer: AudioBuffer, volume: number = 1): void {
    if (!this.context || !this.masterGain) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.context.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start();
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  dispose(): void {
    this.sounds.forEach((sound) => {
      sound.stop();
      sound.disconnect();
    });
    this.sounds.clear();

    this.ambientSounds.forEach((sound) => {
      sound.stop();
      sound.disconnect();
    });
    this.ambientSounds.clear();

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeOscillators = [];

    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}
