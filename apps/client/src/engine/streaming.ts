import { CHUNK_LOAD_DISTANCE, CHUNK_UNLOAD_DISTANCE } from '@genesis/shared';
import { positionToChunkId, getChunksInRadius, chunkDistance } from '@genesis/shared/world';
import type { Vector3 } from '@genesis/shared';

export interface ChunkLoadRequest {
  chunkId: string;
  priority: number;
}

export type ChunkLoader = (chunkId: string, url: string) => Promise<void>;
export type ChunkUnloader = (chunkId: string) => void;

export class StreamingManager {
  private loadedChunks: Set<string> = new Set();
  private loadingChunks: Set<string> = new Set();
  private chunkUrls: Map<string, string> = new Map();

  private loader: ChunkLoader;
  private unloader: ChunkUnloader;

  private lastPlayerChunk: string = '';
  private loadQueue: ChunkLoadRequest[] = [];
  private isProcessingQueue = false;

  constructor(loader: ChunkLoader, unloader: ChunkUnloader) {
    this.loader = loader;
    this.unloader = unloader;
  }

  setChunkUrl(chunkId: string, url: string): void {
    this.chunkUrls.set(chunkId, url);
  }

  update(playerPosition: Vector3): void {
    const currentChunk = positionToChunkId(playerPosition);

    // Only update when player moves to a new chunk
    if (currentChunk === this.lastPlayerChunk) {
      return;
    }

    this.lastPlayerChunk = currentChunk;

    // Get chunks that should be loaded
    const chunksToLoad = getChunksInRadius(currentChunk, CHUNK_LOAD_DISTANCE);
    const chunksToUnload: string[] = [];

    // Mark chunks for unloading
    for (const chunkId of this.loadedChunks) {
      const distance = chunkDistance(currentChunk, chunkId);
      if (distance > CHUNK_UNLOAD_DISTANCE) {
        chunksToUnload.push(chunkId);
      }
    }

    // Unload distant chunks
    for (const chunkId of chunksToUnload) {
      this.unloadChunk(chunkId);
    }

    // Queue chunks for loading with priority based on distance
    for (const chunkId of chunksToLoad) {
      if (!this.loadedChunks.has(chunkId) && !this.loadingChunks.has(chunkId)) {
        const distance = chunkDistance(currentChunk, chunkId);
        this.queueChunkLoad(chunkId, 1 / (distance + 1)); // Higher priority for closer chunks
      }
    }

    // Process queue
    this.processQueue();
  }

  private queueChunkLoad(chunkId: string, priority: number): void {
    // Check if already in queue
    const existingIndex = this.loadQueue.findIndex((r) => r.chunkId === chunkId);
    if (existingIndex >= 0) {
      // Update priority if higher
      if (priority > this.loadQueue[existingIndex].priority) {
        this.loadQueue[existingIndex].priority = priority;
      }
      return;
    }

    this.loadQueue.push({ chunkId, priority });
    this.loadQueue.sort((a, b) => b.priority - a.priority); // Sort by priority descending
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.loadQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    // Process up to 3 chunks concurrently
    const concurrent = 3;
    const batch = this.loadQueue.splice(0, concurrent);

    await Promise.all(
      batch.map(async (request) => {
        await this.loadChunk(request.chunkId);
      })
    );

    this.isProcessingQueue = false;

    // Continue processing if more in queue
    if (this.loadQueue.length > 0) {
      this.processQueue();
    }
  }

  private async loadChunk(chunkId: string): Promise<void> {
    if (this.loadedChunks.has(chunkId) || this.loadingChunks.has(chunkId)) {
      return;
    }

    const url = this.chunkUrls.get(chunkId);
    if (!url) {
      // No URL available yet - might be generating
      return;
    }

    this.loadingChunks.add(chunkId);

    try {
      await this.loader(chunkId, url);
      this.loadedChunks.add(chunkId);
    } catch (error) {
      console.error(`Failed to load chunk ${chunkId}:`, error);
    } finally {
      this.loadingChunks.delete(chunkId);
    }
  }

  private unloadChunk(chunkId: string): void {
    if (!this.loadedChunks.has(chunkId)) {
      return;
    }

    this.unloader(chunkId);
    this.loadedChunks.delete(chunkId);
  }

  getLoadedChunks(): string[] {
    return Array.from(this.loadedChunks);
  }

  getLoadingChunks(): string[] {
    return Array.from(this.loadingChunks);
  }

  isChunkLoaded(chunkId: string): boolean {
    return this.loadedChunks.has(chunkId);
  }

  dispose(): void {
    this.loadQueue = [];
    this.loadedChunks.clear();
    this.loadingChunks.clear();
    this.chunkUrls.clear();
  }
}
