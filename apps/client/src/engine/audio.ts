import * as THREE from 'three';

export class AudioManager {
  private context: AudioContext;
  private listener: THREE.AudioListener;
  private masterGain: GainNode;

  private sounds: Map<string, THREE.PositionalAudio> = new Map();
  private ambientSounds: Map<string, THREE.Audio> = new Map();

  constructor(camera: THREE.PerspectiveCamera) {
    // Create audio context
    this.context = new AudioContext();

    // Create Three.js audio listener
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    // Master gain control
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = 1.0;
  }

  updateListener(position: THREE.Vector3, direction: THREE.Vector3): void {
    // The listener is attached to the camera, so it updates automatically
    // This method is here for any additional audio processing
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

    // Check if already playing
    if (this.sounds.has(id)) {
      return;
    }

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

      // Clean up when done (for non-looping sounds)
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

  async playAmbientSound(
    id: string,
    url: string,
    options: {
      volume?: number;
      loop?: boolean;
    } = {}
  ): Promise<void> {
    const { volume = 0.5, loop = true } = options;

    // Check if already playing
    if (this.ambientSounds.has(id)) {
      return;
    }

    try {
      const sound = new THREE.Audio(this.listener);
      const audioLoader = new THREE.AudioLoader();

      const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
        audioLoader.load(url, resolve, undefined, reject);
      });

      sound.setBuffer(buffer);
      sound.setVolume(volume);
      sound.setLoop(loop);
      sound.play();

      this.ambientSounds.set(id, sound);
    } catch (error) {
      console.error(`Failed to play ambient sound ${id}:`, error);
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
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  getMasterVolume(): number {
    return this.masterGain.gain.value;
  }

  suspend(): void {
    if (this.context.state === 'running') {
      this.context.suspend();
    }
  }

  resume(): void {
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  // Create audio buffer from raw PCM data (for TTS streaming)
  createBufferFromPCM(
    pcmData: Float32Array,
    sampleRate: number = 44100
  ): AudioBuffer {
    const buffer = this.context.createBuffer(1, pcmData.length, sampleRate);
    buffer.copyToChannel(pcmData, 0);
    return buffer;
  }

  // Play audio buffer directly (for voice chat)
  playBuffer(buffer: AudioBuffer, volume: number = 1): void {
    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.context.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start();
  }

  // Get audio context for advanced operations
  getContext(): AudioContext {
    return this.context;
  }

  dispose(): void {
    // Stop all sounds
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

    // Close audio context
    this.context.close();
  }
}
