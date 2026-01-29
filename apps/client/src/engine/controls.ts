import * as THREE from 'three';
import {
  PLAYER_MOVE_SPEED,
  PLAYER_MOUSE_SENSITIVITY,
  PLAYER_HEIGHT,
} from '@genesis/shared';

export class PlayerControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  private velocity: THREE.Vector3 = new THREE.Vector3();
  private direction: THREE.Vector3 = new THREE.Vector3();

  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private isRunning = false;

  private euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private _isLocked = false;

  // Tuning parameters
  private readonly WALK_SPEED = PLAYER_MOVE_SPEED;
  private readonly RUN_SPEED = PLAYER_MOVE_SPEED * 1.8;
  private readonly MOUSE_SENSITIVITY = PLAYER_MOUSE_SENSITIVITY;
  private readonly DAMPING = 10;
  private readonly MIN_PITCH = -Math.PI / 2 + 0.1;
  private readonly MAX_PITCH = Math.PI / 2 - 0.1;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.setupPointerLock();
    this.setupKeyboardControls();
  }

  private setupPointerLock(): void {
    // Click to lock pointer
    this.domElement.addEventListener('click', () => {
      if (!this._isLocked) {
        this.domElement.requestPointerLock();
      }
    });

    // Track pointer lock state
    document.addEventListener('pointerlockchange', () => {
      this._isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('pointerlockerror', () => {
      console.error('Pointer lock error');
    });

    // Mouse movement
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
  }

  private setupKeyboardControls(): void {
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this._isLocked) return;

    this.euler.setFromQuaternion(this.camera.quaternion);

    // Horizontal rotation (yaw)
    this.euler.y -= event.movementX * this.MOUSE_SENSITIVITY;

    // Vertical rotation (pitch) - clamped
    this.euler.x -= event.movementY * this.MOUSE_SENSITIVITY;
    this.euler.x = Math.max(
      this.MIN_PITCH,
      Math.min(this.MAX_PITCH, this.euler.x)
    );

    this.camera.quaternion.setFromEuler(this.euler);
  }

  private onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isRunning = true;
        break;
      case 'Escape':
        if (this._isLocked) {
          document.exitPointerLock();
        }
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isRunning = false;
        break;
    }
  }

  update(deltaTime: number): void {
    if (!this._isLocked) return;

    const speed = this.isRunning ? this.RUN_SPEED : this.WALK_SPEED;

    // Calculate movement direction
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    // Get camera forward and right vectors
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();

    // Calculate target velocity
    const targetVelocity = new THREE.Vector3();

    if (this.moveForward || this.moveBackward) {
      targetVelocity.addScaledVector(forward, this.direction.z * speed);
    }

    if (this.moveLeft || this.moveRight) {
      targetVelocity.addScaledVector(right, this.direction.x * speed);
    }

    // Smoothly interpolate velocity (acceleration/deceleration)
    this.velocity.lerp(targetVelocity, 1 - Math.exp(-this.DAMPING * deltaTime));

    // Apply movement
    this.camera.position.addScaledVector(this.velocity, deltaTime);

    // Keep player at fixed height (no gravity for now)
    this.camera.position.y = PLAYER_HEIGHT;
  }

  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  getRotation(): THREE.Quaternion {
    return this.camera.quaternion.clone();
  }

  getDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }

  getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  isPointerLocked(): boolean {
    return this._isLocked;
  }

  unlock(): void {
    if (this._isLocked) {
      document.exitPointerLock();
    }
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
  }
}
