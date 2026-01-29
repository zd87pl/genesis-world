import type { Vector3, Quaternion } from '../types.js';

/**
 * Create a Vector3
 */
export function vec3(x: number = 0, y: number = 0, z: number = 0): Vector3 {
  return { x, y, z };
}

/**
 * Create a Quaternion
 */
export function quat(
  x: number = 0,
  y: number = 0,
  z: number = 0,
  w: number = 1
): Quaternion {
  return { x, y, z, w };
}

/**
 * Add two vectors
 */
export function addVec3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Subtract two vectors
 */
export function subVec3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Scale a vector
 */
export function scaleVec3(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/**
 * Vector length
 */
export function lengthVec3(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Normalize a vector
 */
export function normalizeVec3(v: Vector3): Vector3 {
  const len = lengthVec3(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Distance between two points
 */
export function distanceVec3(a: Vector3, b: Vector3): number {
  return lengthVec3(subVec3(a, b));
}

/**
 * Dot product
 */
export function dotVec3(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Linear interpolation
 */
export function lerpVec3(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Convert Euler angles (in radians) to Quaternion
 */
export function eulerToQuat(
  x: number,
  y: number,
  z: number,
  order: string = 'YXZ'
): Quaternion {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);

  // YXZ order (common for FPS cameras)
  if (order === 'YXZ') {
    return {
      x: s1 * c2 * c3 + c1 * s2 * s3,
      y: c1 * s2 * c3 - s1 * c2 * s3,
      z: c1 * c2 * s3 - s1 * s2 * c3,
      w: c1 * c2 * c3 + s1 * s2 * s3,
    };
  }

  // Default XYZ order
  return {
    x: s1 * c2 * c3 - c1 * s2 * s3,
    y: c1 * s2 * c3 + s1 * c2 * s3,
    z: c1 * c2 * s3 - s1 * s2 * c3,
    w: c1 * c2 * c3 + s1 * s2 * s3,
  };
}

/**
 * Quaternion spherical interpolation
 */
export function slerpQuat(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

  // If dot is negative, negate one quaternion to take shorter path
  if (dot < 0) {
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    dot = -dot;
  }

  if (dot > 0.9995) {
    // Linear interpolation for very close quaternions
    return normalizeQuat({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      w: a.w + (b.w - a.w) * t,
    });
  }

  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);

  const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return {
    x: a.x * s0 + b.x * s1,
    y: a.y * s0 + b.y * s1,
    z: a.z * s0 + b.z * s1,
    w: a.w * s0 + b.w * s1,
  };
}

function normalizeQuat(q: Quaternion): Quaternion {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (len === 0) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}
