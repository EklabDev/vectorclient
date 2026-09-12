import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { Endpoints } from '../store/endpoints';
import { Logs } from '../store/logs';

export async function logRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/stats/24h', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const userEndpoints = await Endpoints.listByUser(userId);
      const count = await Logs.countSince(
        userEndpoints.map((e) => e.id),
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );
      return { count };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
