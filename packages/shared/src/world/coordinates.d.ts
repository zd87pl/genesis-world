import type { Vector3, Quaternion } from '../types.js';
/**
 * Create a Vector3
 */
export declare function vec3(x?: number, y?: number, z?: number): Vector3;
/**
 * Create a Quaternion
 */
export declare function quat(x?: number, y?: number, z?: number, w?: number): Quaternion;
/**
 * Add two vectors
 */
export declare function addVec3(a: Vector3, b: Vector3): Vector3;
/**
 * Subtract two vectors
 */
export declare function subVec3(a: Vector3, b: Vector3): Vector3;
/**
 * Scale a vector
 */
export declare function scaleVec3(v: Vector3, s: number): Vector3;
/**
 * Vector length
 */
export declare function lengthVec3(v: Vector3): number;
/**
 * Normalize a vector
 */
export declare function normalizeVec3(v: Vector3): Vector3;
/**
 * Distance between two points
 */
export declare function distanceVec3(a: Vector3, b: Vector3): number;
/**
 * Dot product
 */
export declare function dotVec3(a: Vector3, b: Vector3): number;
/**
 * Linear interpolation
 */
export declare function lerpVec3(a: Vector3, b: Vector3, t: number): Vector3;
/**
 * Convert Euler angles (in radians) to Quaternion
 */
export declare function eulerToQuat(x: number, y: number, z: number, order?: string): Quaternion;
/**
 * Quaternion spherical interpolation
 */
export declare function slerpQuat(a: Quaternion, b: Quaternion, t: number): Quaternion;
//# sourceMappingURL=coordinates.d.ts.map