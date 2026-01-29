import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import type { PlayerState, NPCState } from '@genesis/shared';
import { CHUNK_SIZE } from '@genesis/shared';

export class WorldRenderer {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private splatViewer: GaussianSplats3D.Viewer | null = null;

  private loadedChunks: Map<string, GaussianSplats3D.SplatScene> = new Map();
  private otherPlayers: Map<string, THREE.Group> = new Map();
  private npcs: Map<string, THREE.Group> = new Map();
  private npcLabels: Map<string, THREE.Sprite> = new Map();

  private hasWebGPU: boolean = false;
  private clock: THREE.Clock = new THREE.Clock();

  // Animated elements
  private crystal: THREE.Mesh | null = null;
  private crystalLight: THREE.PointLight | null = null;
  private particles: THREE.Points | null = null;
  private fireflies: THREE.Points | null = null;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.hasWebGPU = 'gpu' in navigator;

    // Create renderer with premium settings
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
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    // Dramatic gradient sky
    this.createSky();

    // Atmospheric fog
    this.scene.fog = new THREE.FogExp2(0x88aacc, 0.008);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.setupLighting();
    await this.initializeSplatViewer();

    console.log(`Genesis World initialized (WebGPU: ${this.hasWebGPU})`);
  }

  private createSky(): void {
    // Gradient sky using a large sphere
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077be) },
        bottomColor: { value: new THREE.Color(0xffeedd) },
        offset: { value: 20 },
        exponent: { value: 0.4 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });

    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);
  }

  private setupLighting(): void {
    // Warm ambient
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.4);
    this.scene.add(ambientLight);

    // Golden hour sun
    const sunLight = new THREE.DirectionalLight(0xffddaa, 1.5);
    sunLight.position.set(80, 60, -40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0001;
    this.scene.add(sunLight);

    // Sky fill light
    const hemisphereLight = new THREE.HemisphereLight(0x88aacc, 0x445533, 0.6);
    this.scene.add(hemisphereLight);
  }

  async loadSpawnArea(): Promise<void> {
    this.createTerrain();
    this.createForest();
    this.createMysteriousRuins();
    this.createFloatingParticles();
    this.createFireflies();
  }

  private createTerrain(): void {
    // Procedural terrain with gentle hills
    const size = 400;
    const segments = 128;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

    // Displace vertices for rolling hills
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);

      // Multi-octave noise for natural terrain
      let height = 0;
      height += Math.sin(x * 0.02) * Math.cos(z * 0.02) * 8;
      height += Math.sin(x * 0.05 + 1) * Math.cos(z * 0.04) * 4;
      height += Math.sin(x * 0.1 + 2) * Math.cos(z * 0.08 + 1) * 2;

      // Flatten near spawn
      const distFromCenter = Math.sqrt(x * x + z * z);
      const flattenFactor = Math.min(1, distFromCenter / 30);
      height *= flattenFactor;

      positions.setZ(i, height);
    }

    geometry.computeVertexNormals();

    // Rich grass material
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a7c3f,
      roughness: 0.85,
      metalness: 0.05,
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    terrain.name = 'terrain';

    this.scene.add(terrain);
  }

  private createForest(): void {
    const treeCount = 80;
    const excludeRadius = 25; // Clear area around spawn

    for (let i = 0; i < treeCount; i++) {
      // Random position with spawn exclusion
      let x, z, dist;
      do {
        x = (Math.random() - 0.5) * 300;
        z = (Math.random() - 0.5) * 300;
        dist = Math.sqrt(x * x + z * z);
      } while (dist < excludeRadius);

      const tree = this.createStylizedTree();
      tree.position.set(x, this.getTerrainHeight(x, z), z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      tree.scale.setScalar(0.8 + Math.random() * 0.6);
      this.scene.add(tree);
    }

    // Add some bushes
    for (let i = 0; i < 40; i++) {
      let x, z, dist;
      do {
        x = (Math.random() - 0.5) * 250;
        z = (Math.random() - 0.5) * 250;
        dist = Math.sqrt(x * x + z * z);
      } while (dist < 15);

      const bush = this.createBush();
      bush.position.set(x, this.getTerrainHeight(x, z), z);
      this.scene.add(bush);
    }
  }

  private createStylizedTree(): THREE.Group {
    const tree = new THREE.Group();

    // Trunk with slight curve
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 2, 0.05),
      new THREE.Vector3(-0.05, 4, 0),
      new THREE.Vector3(0, 6, 0),
    ]);

    const trunkGeometry = new THREE.TubeGeometry(trunkCurve, 8, 0.3, 8, false);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3525,
      roughness: 0.95,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;
    tree.add(trunk);

    // Layered foliage
    const foliageColors = [0x2d5a27, 0x3a7233, 0x4a8f3f];

    for (let layer = 0; layer < 3; layer++) {
      const size = 3.5 - layer * 0.8;
      const y = 4 + layer * 2;
      const foliageGeometry = new THREE.ConeGeometry(size, 4, 8);
      const foliageMaterial = new THREE.MeshStandardMaterial({
        color: foliageColors[layer],
        roughness: 0.8,
      });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = y;
      foliage.castShadow = true;
      tree.add(foliage);
    }

    return tree;
  }

  private createBush(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a6b2f,
      roughness: 0.9,
    });

    const bush = new THREE.Mesh(geometry, material);
    bush.scale.y = 0.6;
    bush.scale.x = 0.8 + Math.random() * 0.4;
    bush.scale.z = 0.8 + Math.random() * 0.4;
    bush.castShadow = true;

    return bush;
  }

  private createMysteriousRuins(): void {
    const ruins = new THREE.Group();

    // Ancient stone platform
    const platformGeometry = new THREE.CylinderGeometry(8, 10, 1, 12);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.95,
      metalness: 0.05,
    });

    const platform = new THREE.Mesh(platformGeometry, stoneMaterial);
    platform.position.y = 0.5;
    platform.receiveShadow = true;
    platform.castShadow = true;
    ruins.add(platform);

    // Inner ring
    const innerRingGeometry = new THREE.RingGeometry(4, 5, 32);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      emissive: 0x2244aa,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, glowMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 1.01;
    ruins.add(innerRing);

    // Ancient pillars - some broken
    const pillarPositions = [
      { angle: 0, height: 8, broken: false },
      { angle: Math.PI / 3, height: 5, broken: true },
      { angle: (2 * Math.PI) / 3, height: 8, broken: false },
      { angle: Math.PI, height: 3, broken: true },
      { angle: (4 * Math.PI) / 3, height: 8, broken: false },
      { angle: (5 * Math.PI) / 3, height: 6, broken: true },
    ];

    for (const p of pillarPositions) {
      const pillar = this.createAncientPillar(p.height, p.broken);
      pillar.position.x = Math.cos(p.angle) * 6;
      pillar.position.z = Math.sin(p.angle) * 6;
      ruins.add(pillar);
    }

    // The Crystal - central mystery object
    const crystalGeometry = new THREE.OctahedronGeometry(1.2, 0);
    const crystalMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x4488ff,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.9,
    });

    this.crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    this.crystal.position.y = 4;
    this.crystal.castShadow = true;
    ruins.add(this.crystal);

    // Crystal glow light
    this.crystalLight = new THREE.PointLight(0x4488ff, 3, 20);
    this.crystalLight.position.y = 4;
    this.crystalLight.castShadow = true;
    ruins.add(this.crystalLight);

    // Secondary accent lights
    const accentLight1 = new THREE.PointLight(0x88aaff, 1, 15);
    accentLight1.position.set(3, 2, 3);
    ruins.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0x88aaff, 1, 15);
    accentLight2.position.set(-3, 2, -3);
    ruins.add(accentLight2);

    // Rune stones around the ruins
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 12 + Math.random() * 4;
      const runeStone = this.createRuneStone();
      runeStone.position.x = Math.cos(angle) * dist;
      runeStone.position.z = Math.sin(angle) * dist;
      runeStone.position.y = this.getTerrainHeight(
        runeStone.position.x,
        runeStone.position.z
      );
      runeStone.rotation.y = Math.random() * Math.PI * 2;
      ruins.add(runeStone);
    }

    ruins.position.set(0, 0, 15);
    this.scene.add(ruins);
  }

  private createAncientPillar(height: number, broken: boolean): THREE.Group {
    const pillar = new THREE.Group();

    const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.6, height, 8);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
    });

    const pillarMesh = new THREE.Mesh(pillarGeometry, stoneMaterial);
    pillarMesh.position.y = height / 2 + 1;
    pillarMesh.castShadow = true;
    pillar.add(pillarMesh);

    // Capital on top
    if (!broken) {
      const capitalGeometry = new THREE.BoxGeometry(1.2, 0.5, 1.2);
      const capital = new THREE.Mesh(capitalGeometry, stoneMaterial);
      capital.position.y = height + 1.25;
      capital.castShadow = true;
      pillar.add(capital);
    }

    // Debris for broken pillars
    if (broken) {
      for (let i = 0; i < 3; i++) {
        const debrisGeometry = new THREE.BoxGeometry(
          0.3 + Math.random() * 0.4,
          0.2 + Math.random() * 0.3,
          0.3 + Math.random() * 0.4
        );
        const debris = new THREE.Mesh(debrisGeometry, stoneMaterial);
        debris.position.set(
          (Math.random() - 0.5) * 2,
          0.1,
          (Math.random() - 0.5) * 2
        );
        debris.rotation.set(
          Math.random() * 0.5,
          Math.random() * Math.PI,
          Math.random() * 0.5
        );
        debris.castShadow = true;
        pillar.add(debris);
      }
    }

    return pillar;
  }

  private createRuneStone(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(0.8, 2, 0.4);
    const material = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.85,
      emissive: 0x113366,
      emissiveIntensity: 0.2,
    });

    const stone = new THREE.Mesh(geometry, material);
    stone.rotation.z = (Math.random() - 0.5) * 0.3;
    stone.position.y = 1;
    stone.castShadow = true;

    return stone;
  }

  private createFloatingParticles(): void {
    const count = 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 30 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      // Soft blue/white colors
      colors[i * 3] = 0.6 + Math.random() * 0.4;
      colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  private createFireflies(): void {
    const count = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 5 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;

      // Warm yellow/green colors
      colors[i * 3] = 0.9 + Math.random() * 0.1;
      colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.2 + Math.random() * 0.3;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    this.fireflies = new THREE.Points(geometry, material);
    this.scene.add(this.fireflies);
  }

  private getTerrainHeight(x: number, z: number): number {
    // Match the terrain generation algorithm
    let height = 0;
    height += Math.sin(x * 0.02) * Math.cos(z * 0.02) * 8;
    height += Math.sin(x * 0.05 + 1) * Math.cos(z * 0.04) * 4;
    height += Math.sin(x * 0.1 + 2) * Math.cos(z * 0.08 + 1) * 2;

    const distFromCenter = Math.sqrt(x * x + z * z);
    const flattenFactor = Math.min(1, distFromCenter / 30);
    return height * flattenFactor;
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
      console.warn('Gaussian Splats initialization failed:', error);
    }
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

  updateNPCs(npcStates: NPCState[]): void {
    const currentIds = new Set(npcStates.map((n) => n.id));

    // Remove NPCs that are gone
    for (const [id, group] of this.npcs) {
      if (!currentIds.has(id)) {
        this.scene.remove(group);
        this.npcs.delete(id);
        const label = this.npcLabels.get(id);
        if (label) {
          this.scene.remove(label);
          this.npcLabels.delete(id);
        }
      }
    }

    // Update or add NPCs
    for (const npc of npcStates) {
      let group = this.npcs.get(npc.id);

      if (!group) {
        group = this.createNPCMesh(npc);
        this.scene.add(group);
        this.npcs.set(npc.id, group);

        // Create floating name label
        const label = this.createNPCLabel(npc.name);
        this.scene.add(label);
        this.npcLabels.set(npc.id, label);
      }

      // Update position
      group.position.set(npc.position.x, npc.position.y, npc.position.z);
      group.rotation.y = npc.rotation;

      // Update label position
      const label = this.npcLabels.get(npc.id);
      if (label) {
        label.position.set(npc.position.x, npc.position.y + 2.5, npc.position.z);
      }
    }
  }

  private createNPCMesh(npc: NPCState): THREE.Group {
    const group = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CapsuleGeometry(0.35, 1.0, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.getNPCColor(npc.archetype),
      roughness: 0.6,
      metalness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 12);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);

    // Interaction indicator (glowing ring at feet)
    const indicatorGeometry = new THREE.RingGeometry(0.5, 0.7, 32);
    const indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.y = 0.01;
    indicator.name = 'interaction-indicator';
    group.add(indicator);

    return group;
  }

  private getNPCColor(archetype?: string): number {
    const colors: Record<string, number> = {
      merchant: 0xd4a574,
      guard: 0x5c7080,
      wanderer: 0x7a9e7a,
      quest_giver: 0x9b7bb8,
    };
    return colors[archetype || 'wanderer'] || 0x8899aa;
  }

  private createNPCLabel(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.roundRect(8, 8, 240, 48, 8);
    context.fill();

    context.font = 'bold 28px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.fillText(name, 128, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);

    return sprite;
  }

  updateOtherPlayers(players: PlayerState[]): void {
    const currentIds = new Set(players.map((p) => p.id));

    for (const [id, group] of this.otherPlayers) {
      if (!currentIds.has(id)) {
        this.scene.remove(group);
        this.otherPlayers.delete(id);
      }
    }

    for (const player of players) {
      let group = this.otherPlayers.get(player.id);

      if (!group) {
        group = this.createPlayerMesh(player.name);
        this.scene.add(group);
        this.otherPlayers.set(player.id, group);
      }

      group.position.lerp(
        new THREE.Vector3(
          player.position.x,
          player.position.y - 1.6,
          player.position.z
        ),
        0.2
      );

      // Extract Y rotation from quaternion
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(
          player.rotation.x,
          player.rotation.y,
          player.rotation.z,
          player.rotation.w
        )
      );
      group.rotation.y = euler.y;
    }
  }

  private createPlayerMesh(name: string): THREE.Group {
    const group = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      roughness: 0.5,
      metalness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Name tag
    const label = this.createNPCLabel(name);
    label.position.y = 2.2;
    group.add(label);

    return group;
  }

  render(): void {
    const time = this.clock.getElapsedTime();

    // Animate crystal
    if (this.crystal) {
      this.crystal.rotation.y = time * 0.5;
      this.crystal.rotation.x = Math.sin(time * 0.3) * 0.2;
      this.crystal.position.y = 4 + Math.sin(time) * 0.3;
    }

    // Pulse crystal light
    if (this.crystalLight) {
      this.crystalLight.intensity = 2.5 + Math.sin(time * 2) * 1;
      this.crystalLight.position.y = 4 + Math.sin(time) * 0.3;
    }

    // Animate floating particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        positions.setY(i, y + Math.sin(time + i * 0.1) * 0.003);
      }
      positions.needsUpdate = true;
      this.particles.rotation.y = time * 0.02;
    }

    // Animate fireflies
    if (this.fireflies) {
      const positions = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        positions.setX(i, x + Math.sin(time * 2 + i) * 0.02);
        positions.setZ(i, z + Math.cos(time * 2 + i * 1.5) * 0.02);
      }
      positions.needsUpdate = true;

      // Pulsing opacity
      (this.fireflies.material as THREE.PointsMaterial).opacity =
        0.5 + Math.sin(time * 3) * 0.3;
    }

    // Animate NPC indicators
    for (const [, group] of this.npcs) {
      const indicator = group.getObjectByName('interaction-indicator');
      if (indicator) {
        indicator.rotation.z = time;
        (indicator as THREE.Mesh).material.opacity =
          0.4 + Math.sin(time * 2) * 0.2;
      }
    }

    if (this.splatViewer) {
      this.splatViewer.update();
    }

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

    if (this.splatViewer) {
      this.splatViewer.dispose();
    }

    this.renderer.dispose();
  }
}
