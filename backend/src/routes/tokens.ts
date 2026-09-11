import { FastifyInstance } from 'fastify';
import { TokenService } from '../services/tokenService';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { Tokens } from '../store/tokens';
import { Logs } from '../store/logs';

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
      return TokenService.createToken(userId, body.tokenName, body.expiresIn);
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
      const tokens = await Tokens.listByUser(userId);
      return tokens.map(({ tokenValue, ...rest }) => rest);
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.delete('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const token = await Tokens.findByIdAndUser(id, userId);
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

  app.get('/:id/logs', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const query = request.query as Record<string, string | undefined>;
      const token = await Tokens.findByIdAndUser(id, userId);
      if (!token) {
        reply.code(404).send({ message: 'Token not found' });
        return;
      }
      const page = parseInt(query.page || '1', 10);
      const limit = Math.min(parseInt(query.limit || '50', 10), 500);
      const { logs, total } = await Logs.list({
        apiTokenId: id,
        status: query.status ? parseInt(query.status, 10) : undefined,
        method: query.method?.toUpperCase(),
        startDate: query.startDate,
        endDate: query.endDate,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
        page,
        limit,
      });
      return { logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
