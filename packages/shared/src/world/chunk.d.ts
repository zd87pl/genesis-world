import type { WorldChunk, Vector3, BiomeType } from '../types.js';
/**
 * Create a new world chunk
 */
export declare function createChunk(chunkId: string, options?: Partial<WorldChunk>): WorldChunk;
/**
 * Get chunk ID from world position
 */
export declare function positionToChunkId(position: Vector3): string;
/**
 * Get chunk coordinates from chunk ID
 */
export declare function chunkIdToCoords(chunkId: string): {
    x: number;
    z: number;
};
/**
 * Get world position for chunk center
 */
export declare function chunkIdToWorldPosition(chunkId: string): Vector3;
/**
 * Get adjacent chunk IDs (8 surrounding chunks)
 */
export declare function getAdjacentChunkIds(chunkId: string): string[];
/**
 * Get all chunk IDs within a radius
 */
export declare function getChunksInRadius(centerChunkId: string, radius: number): string[];
/**
 * Calculate distance between two chunks
 */
export declare function chunkDistance(chunkId1: string, chunkId2: string): number;
/**
 * Determine biome based on chunk position (simple algorithm)
 */
export declare function determineBiome(chunkId: string): BiomeType;
//# sourceMappingURL=chunk.d.ts.map