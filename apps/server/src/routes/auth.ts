import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register JWT plugin
  await fastify.register(import('@fastify/jwt'), {
    secret: config.jwtSecret,
  });

  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);

      // In production, this would:
      // 1. Hash password with bcrypt
      // 2. Store user in database
      // 3. Return JWT token

      // For PoC, generate a simple user
      const userId = `user_${Date.now()}`;

      const token = fastify.jwt.sign(
        {
          userId,
          email: body.email,
        },
        { expiresIn: config.jwtExpiry }
      );

      return {
        success: true,
        data: {
          token,
          user: {
            id: userId,
            email: body.email,
            name: body.name,
          },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400);
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.errors[0].message,
          },
        };
      }
      throw error;
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // In production, this would:
      // 1. Look up user in database
      // 2. Verify password with bcrypt
      // 3. Return JWT token

      // For PoC, accept any login
      const userId = `user_${Date.now()}`;

      const token = fastify.jwt.sign(
        {
          userId,
          email: body.email,
        },
        { expiresIn: config.jwtExpiry }
      );

      return {
        success: true,
        data: {
          token,
          user: {
            id: userId,
            email: body.email,
            name: body.email.split('@')[0],
          },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400);
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.errors[0].message,
          },
        };
      }
      throw error;
    }
  });

  // Verify token
  fastify.get('/verify', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        reply.status(401);
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No token provided' },
        };
      }

      const token = authHeader.substring(7);
      const decoded = fastify.jwt.verify(token);

      return {
        success: true,
        data: decoded,
      };
    } catch (error) {
      reply.status(401);
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      };
    }
  });

  // Guest login (for PoC)
  fastify.post('/guest', async () => {
    const guestId = `guest_${Math.random().toString(36).substring(2, 10)}`;

    const token = fastify.jwt.sign(
      {
        userId: guestId,
        email: `${guestId}@guest.local`,
        isGuest: true,
      },
      { expiresIn: '24h' }
    );

    return {
      success: true,
      data: {
        token,
        user: {
          id: guestId,
          email: `${guestId}@guest.local`,
          name: `Guest_${guestId.slice(-4)}`,
          isGuest: true,
        },
      },
    };
  });
}
