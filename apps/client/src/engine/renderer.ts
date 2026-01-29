import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import type { PlayerState } from '@genesis/shared';
import { CHUNK_SIZE, LOD_DISTANCES } from '@genesis/shared';

export class WorldRenderer {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private splatViewer: GaussianSplats3D.Viewer | null = null;

  private loadedChunks: Map<string, GaussianSplats3D.SplatScene> = new Map();
  private otherPlayers: Map<string, THREE.Mesh> = new Map();
  private npcs: Map<string, THREE.Group> = new Map();

  private hasWebGPU: boolean = false;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Detect WebGPU support
    this.hasWebGPU = 'gpu' in navigator;

    // Create renderer (WebGL2 for now, WebGPU when more stable)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Add fog for distance fade
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 300);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Add lighting
    this.setupLighting();

    // Add ground plane (temporary, until splats load)
    this.addGroundPlane();

    // Initialize Gaussian Splat viewer
    await this.initializeSplatViewer();

    console.log(`Renderer initialized (WebGPU: ${this.hasWebGPU})`);
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Hemisphere light for sky/ground color blending
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.4);
    this.scene.add(hemisphereLight);
  }

  private addGroundPlane(): void {
    const geometry = new THREE.PlaneGeometry(1000, 1000);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3d6b3d,
      roughness: 0.8,
      metalness: 0.1,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    ground.name = 'ground';

    this.scene.add(ground);
  }

  private async initializeSplatViewer(): Promise<void> {
    try {
      this.splatViewer = new GaussianSplats3D.Viewer({
        threeScene: this.scene,
        renderer: this.renderer,
        camera: this.camera,
        useBuiltInControls: false,
        selfDrivenMode: false,
        dynamicScene: true,
        gpuAcceleratedSort: true,
        sharedMemoryForWorkers: true,
        integerBasedSort: true,
        halfPrecisionCovariancesOnGPU: true,
        antialiased: false,
        focalAdjustment: 1.0,
      });
    } catch (error) {
      console.warn('Gaussian Splats viewer initialization failed:', error);
      // Continue without splats - we'll use fallback rendering
    }
  }

  async loadSpawnArea(): Promise<void> {
    // In production, this would load a .splat file
    // For now, create some placeholder objects
    this.createPlaceholderEnvironment();
  }

  private createPlaceholderEnvironment(): void {
    // Create some trees
    for (let i = 0; i < 20; i++) {
      const tree = this.createTree();
      tree.position.set(
        (Math.random() - 0.5) * 100,
        0,
        (Math.random() - 0.5) * 100
      );
      this.scene.add(tree);
    }

    // Create some rocks
    for (let i = 0; i < 10; i++) {
      const rock = this.createRock();
      rock.position.set(
        (Math.random() - 0.5) * 80,
        0,
        (Math.random() - 0.5) * 80
      );
      this.scene.add(rock);
    }

    // Add a central structure
    const structure = this.createCentralStructure();
    structure.position.set(0, 0, 10);
    this.scene.add(structure);
  }

  private createTree(): THREE.Group {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage
    const foliageGeometry = new THREE.ConeGeometry(2, 6, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 6;
    foliage.castShadow = true;
    tree.add(foliage);

    return tree;
  }

  private createRock(): THREE.Mesh {
    const geometry = new THREE.DodecahedronGeometry(
      0.5 + Math.random() * 1.5,
      0
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.9,
      metalness: 0.1,
    });

    const rock = new THREE.Mesh(geometry, material);
    rock.scale.y = 0.5 + Math.random() * 0.5;
    rock.rotation.y = Math.random() * Math.PI * 2;
    rock.castShadow = true;

    return rock;
  }

  private createCentralStructure(): THREE.Group {
    const structure = new THREE.Group();

    // Base platform
    const baseGeometry = new THREE.CylinderGeometry(5, 6, 0.5, 8);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x696969,
      roughness: 0.9,
    });
    const base = new THREE.Mesh(baseGeometry, stoneMaterial);
    base.position.y = 0.25;
    base.receiveShadow = true;
    structure.add(base);

    // Pillars
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pillar = this.createPillar();
      pillar.position.set(Math.cos(angle) * 3.5, 0, Math.sin(angle) * 3.5);
      structure.add(pillar);
    }

    // Central crystal
    const crystalGeometry = new THREE.OctahedronGeometry(1, 0);
    const crystalMaterial = new THREE.MeshStandardMaterial({
      color: 0x9370db,
      emissive: 0x4b0082,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.5,
    });
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.y = 3;
    crystal.rotation.x = Math.PI / 4;
    structure.add(crystal);

    // Add point light at crystal
    const crystalLight = new THREE.PointLight(0x9370db, 2, 15);
    crystalLight.position.y = 3;
    structure.add(crystalLight);

    return structure;
  }

  private createPillar(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(0.4, 0.5, 4, 6);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
    });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.y = 2.5;
    pillar.castShadow = true;
    return pillar;
  }

  async loadChunk(chunkId: string, splatUrl: string): Promise<void> {
    if (this.loadedChunks.has(chunkId) || !this.splatViewer) return;

    try {
      const [x, z] = chunkId.split(',').map(Number);

      const splatScene = await this.splatViewer.addSplatScene(splatUrl, {
        showLoadingUI: false,
        progressiveLoad: true,
        position: [x * CHUNK_SIZE, 0, z * CHUNK_SIZE],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      });

      this.loadedChunks.set(chunkId, splatScene);
    } catch (error) {
      console.error(`Failed to load chunk ${chunkId}:`, error);
    }
  }

  unloadChunk(chunkId: string): void {
    const splatScene = this.loadedChunks.get(chunkId);
    if (splatScene && this.splatViewer) {
      this.splatViewer.removeSplatScene(splatScene);
      this.loadedChunks.delete(chunkId);
    }
  }

  updateOtherPlayers(players: PlayerState[]): void {
    const currentIds = new Set(players.map((p) => p.id));

    // Remove players that left
    for (const [id, mesh] of this.otherPlayers) {
      if (!currentIds.has(id)) {
        this.scene.remove(mesh);
        this.otherPlayers.delete(id);
      }
    }

    // Update or add players
    for (const player of players) {
      let mesh = this.otherPlayers.get(player.id);

      if (!mesh) {
        mesh = this.createPlayerMesh();
        this.scene.add(mesh);
        this.otherPlayers.set(player.id, mesh);
      }

      // Update position with interpolation
      mesh.position.lerp(
        new THREE.Vector3(
          player.position.x,
          player.position.y,
          player.position.z
        ),
        0.3
      );

      // Update rotation
      mesh.quaternion.slerp(
        new THREE.Quaternion(
          player.rotation.x,
          player.rotation.y,
          player.rotation.z,
          player.rotation.w
        ),
        0.3
      );
    }
  }

  private createPlayerMesh(): THREE.Mesh {
    const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      roughness: 0.5,
      metalness: 0.3,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.9;
    mesh.castShadow = true;

    return mesh;
  }

  render(): void {
    // Update splat viewer if present
    if (this.splatViewer) {
      this.splatViewer.update();
    }

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  dispose(): void {
    // Dispose of all geometries, materials, textures
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material?.dispose();
        }
      }
    });

    // Dispose of splat viewer
    if (this.splatViewer) {
      this.splatViewer.dispose();
    }

    // Dispose of renderer
    this.renderer.dispose();
  }
}
