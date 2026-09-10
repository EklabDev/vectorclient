import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../config/database';
import { schemas } from '../database/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  WeaviateService,
  WEAVIATE_SEARCH_QUERY_MAX,
  WEAVIATE_SEARCH_MAX,
} from '../services/weaviateService';

const searchBodySchema = z.object({
  query: z.string().min(1).max(WEAVIATE_SEARCH_QUERY_MAX),
  mode: z.enum(['bm25', 'vector', 'hybrid']),
});

const CATEGORY_MAX = 50;

const createChunkBodySchema = z.object({
  content: z.string().min(1),
  originalReference: z.string().optional(),
  category: z.string().max(CATEGORY_MAX).optional(),
  subcategory: z.string().max(CATEGORY_MAX).optional(),
});

const patchChunkBodySchema = z
  .object({
    content: z.string().min(1).optional(),
    category: z.string().max(CATEGORY_MAX).optional(),
    subcategory: z.string().max(CATEGORY_MAX).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.content === undefined && data.category === undefined && data.subcategory === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide at least one of: content, category, subcategory',
        path: [],
      });
    }
  });

const batchCountsBodySchema = z.object({
  ids: z.array(z.string().uuid()).max(50),
});

async function getOwnedPublishedSchema(userId: string, schemaId: string) {
  const [row] = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.id, schemaId), eq(schemas.userId, userId)))
    .limit(1);
  if (!row) return { error: 'not_found' as const };
  if (!row.isPublished) return { error: 'not_published' as const };
  if (!row.weaviateCollectionId) return { error: 'no_collection' as const };
  return { schema: row };
}

export async function schemaWeaviateRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.post('/weaviate/batch-counts', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = batchCountsBodySchema.parse(request.body);

      const rows = await db
        .select()
        .from(schemas)
        .where(and(eq(schemas.userId, userId), inArray(schemas.id, body.ids)));

      const byId = new Map(rows.map((r) => [r.id, r]));
      const counts: Record<string, number> = {};

      for (const id of body.ids) {
        const row = byId.get(id);
        if (!row?.isPublished || !row.weaviateCollectionId) {
          counts[id] = 0;
          continue;
        }
        try {
          const className = WeaviateService.resolveClassName(id, row.weaviateCollectionId);
          counts[id] = await WeaviateService.getClassObjectCount(className);
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

  app.get('/:id/weaviate/objects', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };

      const res = await getOwnedPublishedSchema(userId, id);
      if (res.error === 'not_found') {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      if (res.error === 'not_published') {
        reply.code(400).send({ message: 'Schema must be published to view Weaviate objects' });
        return;
      }
      if (res.error === 'no_collection') {
        reply.code(400).send({ message: 'No Weaviate collection for this schema' });
        return;
      }

      const className = WeaviateService.resolveClassName(id, res.schema.weaviateCollectionId);
      const { objects, truncated } = await WeaviateService.listChunkObjects(className);
      return { objects, truncated };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.get('/:id/weaviate/count', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };

      const res = await getOwnedPublishedSchema(userId, id);
      if (res.error === 'not_found') {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      if (res.error === 'not_published' || res.error === 'no_collection') {
        return { count: 0 };
      }

      const className = WeaviateService.resolveClassName(id, res.schema.weaviateCollectionId);
      const count = await WeaviateService.getClassObjectCount(className);
      return { count };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.post('/:id/weaviate/search', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = searchBodySchema.parse(request.body);

      const res = await getOwnedPublishedSchema(userId, id);
      if (res.error === 'not_found') {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      if (res.error === 'not_published' || res.error === 'no_collection') {
        reply.code(400).send({ message: 'Schema must be published with a Weaviate collection to search' });
        return;
      }

      const className = WeaviateService.resolveClassName(id, res.schema.weaviateCollectionId);
      const objects = await WeaviateService.searchChunkObjects(className, body.query, body.mode, WEAVIATE_SEARCH_MAX);
      return { objects };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.post('/:id/weaviate/objects', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = createChunkBodySchema.parse(request.body);

      const res = await getOwnedPublishedSchema(userId, id);
      if (res.error === 'not_found') {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      if (res.error === 'not_published' || res.error === 'no_collection') {
        reply.code(400).send({ message: 'Schema must be published with a Weaviate collection' });
        return;
      }

      const className = WeaviateService.resolveClassName(id, res.schema.weaviateCollectionId);
      const chunkIndex = await WeaviateService.getNextChunkIndex(className);
      const newId = await WeaviateService.createChunkObject(className, {
        content: body.content,
        originalReference: body.originalReference,
        schemaId: id,
        schemaName: res.schema.name,
        version: res.schema.version,
        chunkIndex,
        category: body.category,
        subcategory: body.subcategory,
      });

      return { id: newId, chunkIndex };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.patch('/:id/weaviate/objects/:objectId', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id, objectId } = request.params as { id: string; objectId: string };
      const body = patchChunkBodySchema.parse(request.body);

      const res = await getOwnedPublishedSchema(userId, id);
      if (res.error === 'not_found') {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      if (res.error === 'not_published' || res.error === 'no_collection') {
        reply.code(400).send({ message: 'Schema must be published with a Weaviate collection' });
        return;
      }

      const className = WeaviateService.resolveClassName(id, res.schema.weaviateCollectionId);
      await WeaviateService.patchChunkObject(className, objectId, {
        ...(body.content !== undefined && { content: body.content }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.subcategory !== undefined && { subcategory: body.subcategory }),
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.delete('/:id/weaviate/objects/:objectId', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id, objectId } = request.params as { id: string; objectId: string };

      const res = await getOwnedPublishedSchema(userId, id);
      if (res.error === 'not_found') {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      if (res.error === 'not_published' || res.error === 'no_collection') {
        reply.code(400).send({ message: 'Schema must be published with a Weaviate collection' });
        return;
      }

      const className = WeaviateService.resolveClassName(id, res.schema.weaviateCollectionId);
      await WeaviateService.deleteChunkObject(className, objectId);
      return { ok: true };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
