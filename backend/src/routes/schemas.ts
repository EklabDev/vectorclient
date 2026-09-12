import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { Schemas } from '../store/schemas';
import { ArcadeKnowledgeService } from '../services/arcadeKnowledgeService';

const createSchemaSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  content: z.string().min(1),
  systemPrompt: z.string().nullable().optional(),
  isPublished: z.boolean().optional().default(false),
});

const updateSchemaSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  systemPrompt: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
});

async function publishKnowledge(
  userId: string,
  schema: { id: string; name: string; content: string; version: number }
): Promise<void> {
  await ArcadeKnowledgeService.replaceSchemaChunks(
    userId,
    schema.id,
    schema.name,
    schema.content,
    schema.version
  );
}

export async function schemaRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      return Schemas.listByUser(userId);
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.get('/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const schema = await Schemas.findByIdAndUser(id, userId);
    if (!schema) {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    return schema;
  });

  app.post('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = createSchemaSchema.parse(request.body);
      const created = await Schemas.create({
        userId,
        name: body.name,
        description: body.description || null,
        content: body.content,
        systemPrompt: body.systemPrompt ?? null,
        isPublished: body.isPublished ?? false,
      });
      if (created.isPublished) {
        try {
          await publishKnowledge(userId, created);
        } catch (err) {
          console.error('Failed to publish schema knowledge:', err);
        }
      }
      return created;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.patch('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = updateSchemaSchema.parse(request.body);
      const existing = await Schemas.findByIdAndUser(id, userId);
      if (!existing) {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }
      const newVersion = body.content !== undefined ? existing.version + 1 : existing.version;
      const willBePublished = body.isPublished !== undefined ? body.isPublished : existing.isPublished;
      const isBeingUnpublished = body.isPublished === false && existing.isPublished;
      const updated = await Schemas.update(id, {
        ...(body.content !== undefined && { content: body.content, version: newVersion }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      });
      const next = updated!;
      if (willBePublished) {
        try {
          await publishKnowledge(userId, {
            id,
            name: next.name,
            content: next.content,
            version: next.version,
          });
        } catch (err) {
          console.error('Failed to sync schema knowledge:', err);
        }
      } else if (isBeingUnpublished) {
        try {
          await ArcadeKnowledgeService.deleteSchemaChunks(userId, id);
        } catch (err) {
          console.error('Failed to delete schema chunks:', err);
        }
      }
      return next;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.delete('/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const existing = await Schemas.findByIdAndUser(id, userId);
    if (!existing) {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    try {
      await ArcadeKnowledgeService.deleteSchemaChunks(userId, id);
    } catch (err) {
      console.error('Failed to delete schema chunks:', err);
    }
    await Schemas.remove(id);
    return { message: 'Schema deleted successfully' };
  });

  app.post('/:id/sync-weaviate', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const existing = await Schemas.findByIdAndUser(id, userId);
    if (!existing) {
      reply.code(404).send({ message: 'Schema not found' });
      return;
    }
    if (!existing.isPublished) {
      reply.code(400).send({ message: 'Schema must be published before syncing knowledge' });
      return;
    }
    await publishKnowledge(userId, existing);
    return { message: 'Schema synced to ArcadeDB successfully' };
  });
}
