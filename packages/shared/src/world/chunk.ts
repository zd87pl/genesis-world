import type { WorldChunk, Vector3, BiomeType } from '../types.js';
import { CHUNK_SIZE } from '../constants.js';

/**
 * Create a new world chunk
 */
export function createChunk(
  chunkId: string,
  options: Partial<WorldChunk> = {}
): WorldChunk {
  return {
    id: chunkId,
    status: 'loading',
    npcs: [],
    pointsOfInterest: [],
    ...options,
  };
}

/**
 * Get chunk ID from world position
 */
export function positionToChunkId(position: Vector3): string {
  const cx = Math.floor(position.x / CHUNK_SIZE);
  const cz = Math.floor(position.z / CHUNK_SIZE);
  return `${cx},${cz}`;
}

/**
 * Get chunk coordinates from chunk ID
 */
export function chunkIdToCoords(chunkId: string): { x: number; z: number } {
  const [x, z] = chunkId.split(',').map(Number);
  return { x, z };
}

/**
 * Get world position for chunk center
 */
export function chunkIdToWorldPosition(chunkId: string): Vector3 {
  const { x, z } = chunkIdToCoords(chunkId);
  return {
    x: x * CHUNK_SIZE + CHUNK_SIZE / 2,
    y: 0,
    z: z * CHUNK_SIZE + CHUNK_SIZE / 2,
  };
}

/**
 * Get adjacent chunk IDs (8 surrounding chunks)
 */
export function getAdjacentChunkIds(chunkId: string): string[] {
  const { x, z } = chunkIdToCoords(chunkId);
  const adjacent: string[] = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      adjacent.push(`${x + dx},${z + dz}`);
    }
  }

  return adjacent;
}

/**
 * Get all chunk IDs within a radius
 */
export function getChunksInRadius(
  centerChunkId: string,
  radius: number
): string[] {
  const { x: cx, z: cz } = chunkIdToCoords(centerChunkId);
  const chunks: string[] = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      chunks.push(`${cx + dx},${cz + dz}`);
    }
  }

  return chunks;
}

/**
 * Calculate distance between two chunks
 */
export function chunkDistance(chunkId1: string, chunkId2: string): number {
  const c1 = chunkIdToCoords(chunkId1);
  const c2 = chunkIdToCoords(chunkId2);
  return Math.sqrt(Math.pow(c2.x - c1.x, 2) + Math.pow(c2.z - c1.z, 2));
}

/**
 * Determine biome based on chunk position (simple algorithm)
 */
export function determineBiome(chunkId: string): BiomeType {
  const { x, z } = chunkIdToCoords(chunkId);
  const distance = Math.sqrt(x * x + z * z);

  // Spawn area is plains
  if (distance < 2) return 'plains';

  // Use noise-like deterministic function
  const seed = hashString(chunkId);
  const normalized = (seed % 100) / 100;

  if (normalized < 0.25) return 'forest';
  if (normalized < 0.4) return 'plains';
  if (normalized < 0.55) return 'urban';
  if (normalized < 0.7) return 'coastal';
  if (normalized < 0.85) return 'desert';
  return 'mystical';
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
