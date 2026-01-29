import type { Vector3 } from '../types.js';

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

export interface BoundingSphere {
  center: Vector3;
  radius: number;
}

/**
 * Create a bounding box
 */
export function createBoundingBox(min: Vector3, max: Vector3): BoundingBox {
  return { min, max };
}

/**
 * Create a bounding sphere
 */
export function createBoundingSphere(
  center: Vector3,
  radius: number
): BoundingSphere {
  return { center, radius };
}

/**
 * Check if a point is inside a bounding box
 */
export function pointInBox(point: Vector3, box: BoundingBox): boolean {
  return (
    point.x >= box.min.x &&
    point.x <= box.max.x &&
    point.y >= box.min.y &&
    point.y <= box.max.y &&
    point.z >= box.min.z &&
    point.z <= box.max.z
  );
}

/**
 * Check if a point is inside a bounding sphere
 */
export function pointInSphere(point: Vector3, sphere: BoundingSphere): boolean {
  const dx = point.x - sphere.center.x;
  const dy = point.y - sphere.center.y;
  const dz = point.z - sphere.center.z;
  return dx * dx + dy * dy + dz * dz <= sphere.radius * sphere.radius;
}

/**
 * Check if two bounding boxes intersect
 */
export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

/**
 * Check if two bounding spheres intersect
 */
export function spheresIntersect(
  a: BoundingSphere,
  b: BoundingSphere
): boolean {
  const dx = b.center.x - a.center.x;
  const dy = b.center.y - a.center.y;
  const dz = b.center.z - a.center.z;
  const distSquared = dx * dx + dy * dy + dz * dz;
  const radiusSum = a.radius + b.radius;
  return distSquared <= radiusSum * radiusSum;
}

/**
 * Expand bounding box to include a point
 */
export function expandBox(box: BoundingBox, point: Vector3): BoundingBox {
  return {
    min: {
      x: Math.min(box.min.x, point.x),
      y: Math.min(box.min.y, point.y),
      z: Math.min(box.min.z, point.z),
    },
    max: {
      x: Math.max(box.max.x, point.x),
      y: Math.max(box.max.y, point.y),
      z: Math.max(box.max.z, point.z),
    },
  };
}

/**
 * Get the center of a bounding box
 */
export function getBoxCenter(box: BoundingBox): Vector3 {
  return {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
}

/**
 * Get the size of a bounding box
 */
export function getBoxSize(box: BoundingBox): Vector3 {
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  };
}
