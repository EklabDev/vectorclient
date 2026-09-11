import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { query } from '../arcade/client';
import { knowledgeDbName } from '../arcade/config';

const queryBody = z.object({
  language: z.enum(['sql', 'cypher', 'gremlin']).default('sql'),
  command: z.string().min(1).max(20000),
  database: z.enum(['knowledge']).default('knowledge'),
  params: z.record(z.string(), z.unknown()).optional(),
});

export async function studioRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/query', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = queryBody.parse(request.body);
      const database = knowledgeDbName(userId);
      const started = Date.now();
      const result = await query(database, body.command, body.params || {}, body.language);
      return { result, elapsedMs: Date.now() - started, database };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/schema', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const database = knowledgeDbName(userId);
      const types = await query(database, 'SELECT FROM schema:types');
      const indexes = await query(database, 'SELECT FROM schema:indexes');
      return { database, types, indexes };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
