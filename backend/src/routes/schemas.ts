import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../config/database';
import { schemas } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { WeaviateService } from '../services/weaviateService';

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
          weaviateCollectionId: schemas.weaviateCollectionId,
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

      const schemaId = uuidv4();
      let weaviateCollectionId: string | null = null;

      // Always sync to Weaviate when creating a new schema
      try {
        weaviateCollectionId = await WeaviateService.syncSchemaToWeaviate(
          schemaId,
          body.name,
          body.content,
          body.description || null
        );
      } catch (weaviateError) {
        console.error('Failed to sync schema to Weaviate:', weaviateError);
        // Continue with creation even if Weaviate sync fails
      }

      const [newSchema] = await db
        .insert(schemas)
        .values({
          id: schemaId,
          userId,
          name: body.name,
          description: body.description || null,
          content: body.content,
          version: 1,
          isPublished: body.isPublished ?? false,
          weaviateCollectionId: weaviateCollectionId,
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
      const newVersion = body.content !== undefined ? existing.version + 1 : existing.version;
      if (body.content !== undefined) {
        updateData.content = body.content;
        updateData.version = newVersion;
      }
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      
      // Handle publishing/unpublishing
      const willBePublished = body.isPublished !== undefined ? body.isPublished : existing.isPublished;
      const isBeingPublished = body.isPublished === true && !existing.isPublished;
      const isBeingUnpublished = body.isPublished === false && existing.isPublished;
      
      if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;

      // Sync to Weaviate
      if (willBePublished) {
        try {
          // If being published for the first time or content/name/description changed, sync to Weaviate
          if (isBeingPublished || body.content !== undefined || body.name !== undefined || body.description !== undefined) {
            const collectionName = existing.weaviateCollectionId
              ? await WeaviateService.updateSchemaInWeaviate(
                  id,
                  body.name !== undefined ? body.name : existing.name,
                  body.content !== undefined ? body.content : existing.content,
                  newVersion,
                  body.description !== undefined ? body.description : existing.description
                )
              : await WeaviateService.syncSchemaToWeaviate(
                  id,
                  body.name !== undefined ? body.name : existing.name,
                  body.content !== undefined ? body.content : existing.content,
                  body.description !== undefined ? body.description : existing.description
                );
            updateData.weaviateCollectionId = collectionName;
          }
        } catch (weaviateError) {
          console.error('Failed to sync schema to Weaviate:', weaviateError);
          // Continue with update even if Weaviate sync fails
        }
      } else if (isBeingUnpublished && existing.weaviateCollectionId) {
        // If unpublishing, delete from Weaviate
        try {
          await WeaviateService.deleteCollectionFromWeaviate(existing.weaviateCollectionId);
          updateData.weaviateCollectionId = null;
        } catch (weaviateError) {
          console.error('Failed to delete schema from Weaviate:', weaviateError);
          // Continue with update even if Weaviate deletion fails
        }
      }

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

      // Delete from Weaviate if it exists
      if (existing.weaviateCollectionId) {
        try {
          await WeaviateService.deleteCollectionFromWeaviate(existing.weaviateCollectionId);
        } catch (weaviateError) {
          console.error('Failed to delete schema from Weaviate:', weaviateError);
          // Continue with deletion even if Weaviate deletion fails
        }
      }

      await db.delete(schemas).where(eq(schemas.id, id));

      return { message: 'Schema deleted successfully' };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Manually sync a schema to Weaviate (for existing schemas that weren't synced)
  app.post('/:id/sync-weaviate', async (request, reply) => {
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

      if (!existing.isPublished) {
        reply.code(400).send({ message: 'Schema must be published before syncing to Weaviate' });
        return;
      }

      // Sync to Weaviate
      let weaviateCollectionId: string | null = null;
      try {
        weaviateCollectionId = existing.weaviateCollectionId
          ? await WeaviateService.updateSchemaInWeaviate(
              id,
              existing.name,
              existing.content,
              existing.version,
              existing.description
            )
          : await WeaviateService.syncSchemaToWeaviate(
              id,
              existing.name,
              existing.content,
              existing.description
            );

        // Update the weaviateCollectionId in the database
        await db
          .update(schemas)
          .set({ weaviateCollectionId })
          .where(eq(schemas.id, id));

        return { message: 'Schema synced to Weaviate successfully', weaviateCollectionId };
      } catch (weaviateError) {
        reply.code(500).send({ 
          message: 'Failed to sync schema to Weaviate', 
          error: (weaviateError as Error).message 
        });
      }
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });
}
