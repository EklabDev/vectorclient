import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { db } from '../config/database';
import { callLogs, endpoints } from '../database/schema';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';

export async function logRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // Get request count for last 24 hours for all user endpoints
  app.get('/stats/24h', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      
      // Calculate 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get all user's endpoint IDs
      const userEndpoints = await db
        .select({ id: endpoints.id })
        .from(endpoints)
        .where(eq(endpoints.userId, userId));

      const endpointIds = userEndpoints.map(e => e.id);

      if (endpointIds.length === 0) {
        return { count: 0 };
      }

      // Count call logs for these endpoints in the last 24 hours
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(callLogs)
        .where(
          and(
            inArray(callLogs.endpointId, endpointIds),
            gte(callLogs.createdAt, twentyFourHoursAgo)
          )
        );

      return { count: Number(result.count) };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
