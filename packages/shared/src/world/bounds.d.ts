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
export declare function createBoundingBox(min: Vector3, max: Vector3): BoundingBox;
/**
 * Create a bounding sphere
 */
export declare function createBoundingSphere(center: Vector3, radius: number): BoundingSphere;
/**
 * Check if a point is inside a bounding box
 */
export declare function pointInBox(point: Vector3, box: BoundingBox): boolean;
/**
 * Check if a point is inside a bounding sphere
 */
export declare function pointInSphere(point: Vector3, sphere: BoundingSphere): boolean;
/**
 * Check if two bounding boxes intersect
 */
export declare function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean;
/**
 * Check if two bounding spheres intersect
 */
export declare function spheresIntersect(a: BoundingSphere, b: BoundingSphere): boolean;
/**
 * Expand bounding box to include a point
 */
export declare function expandBox(box: BoundingBox, point: Vector3): BoundingBox;
/**
 * Get the center of a bounding box
 */
export declare function getBoxCenter(box: BoundingBox): Vector3;
/**
 * Get the size of a bounding box
 */
export declare function getBoxSize(box: BoundingBox): Vector3;
//# sourceMappingURL=bounds.d.ts.map