declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Scene, Camera, WebGLRenderer } from 'three';

  export interface SplatScene {
    // Opaque handle for a loaded splat scene
    [key: string]: any;
  }

  export class Viewer {
    constructor(options?: {
      // Scene/rendering
      threeScene?: Scene;
      renderer?: WebGLRenderer;
      camera?: Camera;
      rootElement?: HTMLElement;
      scene?: Scene;

      // Camera
      cameraUp?: number[];
      initialCameraPosition?: number[];
      initialCameraLookAt?: number[];

      // Controls
      selfDrivenMode?: boolean;
      useBuiltInControls?: boolean;

      // Performance
      sharedMemoryForWorkers?: boolean;
      dynamicScene?: boolean;
      gpuAcceleratedSort?: boolean;
      integerBasedSort?: boolean;
      halfPrecisionCovariancesOnGPU?: boolean;
      antialiased?: boolean;
      focalAdjustment?: number;

      // Other
      [key: string]: any;
    });

    addSplatScene(
      url: string,
      options?: {
        splatAlphaRemovalThreshold?: number;
        showLoadingUI?: boolean;
        progressiveLoad?: boolean;
        position?: number[];
        rotation?: number[];
        scale?: number[];
        [key: string]: any;
      }
    ): Promise<SplatScene>;

    removeSplatScene(scene: SplatScene | number): void;

    update(): void;

    render(): void;

    dispose(): void;

    getSplatScene(index: number): SplatScene | null;

    setSize(width: number, height: number): void;
  }

  export class DropInViewer extends Viewer {
    constructor(options?: {
      gpuAcceleratedSort?: boolean;
      sharedMemoryForWorkers?: boolean;
      selfDrivenMode?: boolean;
      [key: string]: any;
    });
  }
}
