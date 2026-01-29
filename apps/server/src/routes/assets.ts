import { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function assetRoutes(fastify: FastifyInstance) {
  // Get signed URL for asset upload
  fastify.post('/upload-url', async (request, reply) => {
    const body = request.body as { filename: string; contentType: string };

    if (!config.r2AccessKey) {
      reply.status(501);
      return {
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'Asset storage not configured' },
      };
    }

    // In production, generate a signed URL for R2/S3
    // For PoC, return a placeholder
    const key = `uploads/${Date.now()}_${body.filename}`;

    return {
      success: true,
      data: {
        uploadUrl: `${config.r2PublicUrl}/${key}`,
        key,
        expiresIn: 3600,
      },
    };
  });

  // Get asset URL
  fastify.get('/url/:key', async (request) => {
    const { key } = request.params as { key: string };

    // In production, this would verify access and return a signed URL
    const url = config.r2PublicUrl
      ? `${config.r2PublicUrl}/${key}`
      : `/assets/${key}`;

    return {
      success: true,
      data: { url },
    };
  });

  // Get spawn area splat URL
  fastify.get('/spawn-splat', async () => {
    // In production, this would return the actual splat file URL
    return {
      success: true,
      data: {
        url: null, // No splat file for PoC - using placeholder geometry
        fallback: true,
      },
    };
  });

  // Get chunk splat URL
  fastify.get('/chunk/:chunkId', async (request, reply) => {
    const { chunkId } = request.params as { chunkId: string };

    // In production, look up the generated splat for this chunk
    // For PoC, return placeholder

    // Validate chunk ID format
    if (!/^-?\d+,-?\d+$/.test(chunkId)) {
      reply.status(400);
      return {
        success: false,
        error: { code: 'INVALID_CHUNK_ID', message: 'Invalid chunk ID format' },
      };
    }

    return {
      success: true,
      data: {
        chunkId,
        url: null, // No splat file for PoC
        status: 'pending',
      },
    };
  });
}
