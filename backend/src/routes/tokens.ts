import { FastifyInstance } from 'fastify';
import { TokenService } from '../services/tokenService';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../config/database';
import { apiTokens, callLogs } from '../database/schema';
import { eq, and, desc, asc, gte, lte, sql } from 'drizzle-orm';

const createTokenSchema = z.object({
  tokenName: z.string().min(1),
  expiresIn: z.number().optional(),
});

export async function tokenRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = createTokenSchema.parse(request.body);
      const result = await TokenService.createToken(userId, body.tokenName, body.expiresIn);
      return result;
    } catch (error) {
       if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.get('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const tokens = await db
        .select({
          id: apiTokens.id,
          tokenName: apiTokens.tokenName,
          tokenPrefix: apiTokens.tokenPrefix,
          isActive: apiTokens.isActive,
          lastUsedAt: apiTokens.lastUsedAt,
          createdAt: apiTokens.createdAt,
          expiresAt: apiTokens.expiresAt,
        })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId));
      return tokens;
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.delete('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };

      // Verify ownership
      const [token] = await db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
        .limit(1);

      if (!token) {
        reply.code(404).send({ message: 'Token not found' });
        return;
      }

      await TokenService.revokeToken(id);
      return { message: 'Token revoked' };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Get call logs for a token (usage history)
  app.get('/:id/logs', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const query = request.query as {
        page?: string;
        limit?: string;
        status?: string;
        method?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: string;
      };

      // Verify token belongs to user
      const [token] = await db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
        .limit(1);

      if (!token) {
        reply.code(404).send({ message: 'Token not found' });
        return;
      }

      // Parse query parameters
      const page = parseInt(query.page || '1', 10);
      const limit = Math.min(parseInt(query.limit || '50', 10), 500);
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(callLogs.apiTokenId, id)];

      if (query.status) {
        conditions.push(eq(callLogs.status, parseInt(query.status, 10)));
      }

      if (query.method) {
        conditions.push(eq(callLogs.method, query.method.toUpperCase()));
      }

      if (query.startDate) {
        conditions.push(gte(callLogs.createdAt, new Date(query.startDate)));
      }

      if (query.endDate) {
        conditions.push(lte(callLogs.createdAt, new Date(query.endDate)));
      }

      // Determine sort order
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? asc : desc;

      // Build order by
      let orderByClause;
      if (sortBy === 'responseTime') {
        orderByClause = sortOrder(callLogs.responseTime);
      } else if (sortBy === 'status') {
        orderByClause = sortOrder(callLogs.status);
      } else {
        orderByClause = sortOrder(callLogs.createdAt);
      }

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(callLogs)
        .where(and(...conditions));

      const total = Number(countResult.count);

      // Get logs
      const logs = await db
        .select()
        .from(callLogs)
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
