import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../config/database';
import { schemas } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const createSchemaSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  content: z.string().min(1),
  isPublished: z.boolean().optional().default(false),
});

const updateSchemaSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
});

export async function schemaRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // List all schemas for the user
  app.get('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const userSchemas = await db
        .select({
          id: schemas.id,
          name: schemas.name,
          description: schemas.description,
          content: schemas.content,
          version: schemas.version,
          isPublished: schemas.isPublished,
          createdAt: schemas.createdAt,
          updatedAt: schemas.updatedAt,
        })
        .from(schemas)
        .where(eq(schemas.userId, userId));
      return userSchemas;
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Get a specific schema
  app.get('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };

      const [schema] = await db
        .select()
        .from(schemas)
        .where(and(eq(schemas.id, id), eq(schemas.userId, userId)))
        .limit(1);

      if (!schema) {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }

      return schema;
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Create a new schema
  app.post('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = createSchemaSchema.parse(request.body);

      const [newSchema] = await db
        .insert(schemas)
        .values({
          id: uuidv4(),
          userId,
          name: body.name,
          description: body.description || null,
          content: body.content,
          version: 1,
          isPublished: body.isPublished ?? false,
        })
        .returning();

      return newSchema;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Update a schema
  app.patch('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = updateSchemaSchema.parse(request.body);

      // Verify ownership
      const [existing] = await db
        .select()
        .from(schemas)
        .where(and(eq(schemas.id, id), eq(schemas.userId, userId)))
        .limit(1);

      if (!existing) {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }

      // Build update object with only provided fields
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      // Increment version if content is being updated
      if (body.content !== undefined) {
        updateData.content = body.content;
        updateData.version = existing.version + 1;
      }
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;

      const [updated] = await db
        .update(schemas)
        .set(updateData)
        .where(eq(schemas.id, id))
        .returning();

      return updated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Delete a schema
  app.delete('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };

      // Verify ownership
      const [existing] = await db
        .select()
        .from(schemas)
        .where(and(eq(schemas.id, id), eq(schemas.userId, userId)))
        .limit(1);

      if (!existing) {
        reply.code(404).send({ message: 'Schema not found' });
        return;
      }

      await db.delete(schemas).where(eq(schemas.id, id));

      return { message: 'Schema deleted successfully' };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
