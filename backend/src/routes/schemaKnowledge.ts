import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { Schemas } from '../store/schemas';
import {
  ArcadeKnowledgeService,
  KNOWLEDGE_SEARCH_MAX,
  KNOWLEDGE_SEARCH_QUERY_MAX,
} from '../services/arcadeKnowledgeService';

const searchBodySchema = z.object({
  query: z.string().min(1).max(KNOWLEDGE_SEARCH_QUERY_MAX),
  mode: z.enum(['bm25', 'vector', 'hybrid']),
});

const createChunkBodySchema = z.object({
  content: z.string().min(1),
  originalReference: z.string().optional(),
  category: z.string().max(50).optional(),
  subcategory: z.string().max(50).optional(),
});

const patchChunkBodySchema = z
  .object({
    content: z.string().min(1).optional(),
    category: z.string().max(50).optional(),
    subcategory: z.string().max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.content === undefined && data.category === undefined && data.subcategory === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Provide at least one of: content, category, subcategory' });
    }
  });

async function ownedPublished(userId: string, schemaId: string) {
  const row = await Schemas.findByIdAndUser(schemaId, userId);
  if (!row) return { error: 'not_found' as const };
  if (!row.isPublished) return { error: 'not_published' as const };
  return { schema: row };
}

export async function schemaKnowledgeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/knowledge/batch-counts', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = z.object({ ids: z.array(z.string().uuid()).max(50) }).parse(request.body);
      const rows = await Schemas.findByIds(userId, body.ids);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const counts: Record<string, number> = {};
      for (const id of body.ids) {
        const row = byId.get(id);
        if (!row?.isPublished) {
          counts[id] = 0;
          continue;
        }
        try {
          counts[id] = await ArcadeKnowledgeService.countChunks(userId, id);
        } catch {
          counts[id] = 0;
        }
      }
      return { counts };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.get('/:id/knowledge/objects', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const res = await ownedPublished(userId, id);
    if (res.error === 'not_found') {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    if (res.error === 'not_published') {
      reply.code(400).send({ message: 'Schema must be published to view knowledge objects' });
      return;
    }
    return ArcadeKnowledgeService.listChunks(userId, id);
  });

  app.get('/:id/knowledge/count', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const res = await ownedPublished(userId, id);
    if (res.error === 'not_found') {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    if (res.error === 'not_published') return { count: 0 };
    return { count: await ArcadeKnowledgeService.countChunks(userId, id) };
  });

  app.post('/:id/knowledge/search', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = searchBodySchema.parse(request.body);
      const res = await ownedPublished(userId, id);
      if (res.error === 'not_found') {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      if (res.error === 'not_published') {
        reply.code(400).send({ message: 'Schema must be published to search' });
        return;
      }
      const objects = await ArcadeKnowledgeService.searchChunks(userId, body.query, body.mode, KNOWLEDGE_SEARCH_MAX, {
        schemaId: id,
      });
      return { objects };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.post('/:id/knowledge/objects', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const body = createChunkBodySchema.parse(request.body);
    const res = await ownedPublished(userId, id);
    if (res.error === 'not_found') {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    if (res.error === 'not_published') {
      reply.code(400).send({ message: 'Schema must be published' });
      return;
    }
    return ArcadeKnowledgeService.createChunk(userId, id, res.schema.name, res.schema.version, body);
  });

  app.patch('/:id/knowledge/objects/:objectId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, objectId } = request.params as { id: string; objectId: string };
    const body = patchChunkBodySchema.parse(request.body);
    const res = await ownedPublished(userId, id);
    if (res.error === 'not_found') {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    if (res.error === 'not_published') {
      reply.code(400).send({ message: 'Schema must be published' });
      return;
    }
    await ArcadeKnowledgeService.patchChunk(userId, objectId, body);
    return { ok: true };
  });

  app.delete('/:id/knowledge/objects/:objectId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, objectId } = request.params as { id: string; objectId: string };
    const res = await ownedPublished(userId, id);
    if (res.error === 'not_found') {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    if (res.error === 'not_published') {
      reply.code(400).send({ message: 'Schema must be published' });
      return;
    }
    await ArcadeKnowledgeService.deleteChunk(userId, objectId);
    return { ok: true };
  });
}
