import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../config/database';
import { endpoints, endpointApiTokens, endpointSchemas, apiTokens, schemas, callLogs } from '../database/schema';
import { eq, and, inArray, asc, desc, gte, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const createEndpointSchema = z.object({
  routeName: z.string().min(1),
  route: z.string().min(1),
  rateLimit: z.number().int().positive().optional().default(100),
  rateLimitWindowMs: z.number().int().positive().optional().default(60000),
  allowedOrigins: z.array(z.string()).optional().default([]),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  apiTokenIds: z.array(z.string().uuid()).optional().default([]),
  schemaIds: z.array(z.string().uuid()).optional().default([]),
});

const updateEndpointSchema = createEndpointSchema.partial();

export async function endpointRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // List all endpoints for the user with associations
  app.get('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const userEndpoints = await db
        .select({
          id: endpoints.id,
          userId: endpoints.userId,
          routeName: endpoints.routeName,
          route: endpoints.route,
          rateLimit: endpoints.rateLimit,
          rateLimitWindowMs: endpoints.rateLimitWindowMs,
          allowedOrigins: endpoints.allowedOrigins,
          description: endpoints.description,
          isActive: endpoints.isActive,
          createdAt: endpoints.createdAt,
          updatedAt: endpoints.updatedAt,
        })
        .from(endpoints)
        .where(eq(endpoints.userId, userId));

      // Fetch associations for each endpoint
      const endpointsWithAssociations = await Promise.all(
        userEndpoints.map(async (endpoint) => {
          // Get associated tokens
          const associatedTokens = await db
            .select({
              id: apiTokens.id,
              tokenName: apiTokens.tokenName,
              tokenPrefix: apiTokens.tokenPrefix,
            })
            .from(endpointApiTokens)
            .innerJoin(apiTokens, eq(endpointApiTokens.apiTokenId, apiTokens.id))
            .where(eq(endpointApiTokens.endpointId, endpoint.id));

          // Get associated schemas
          const associatedSchemas = await db
            .select({
              id: schemas.id,
              name: schemas.name,
              order: endpointSchemas.order,
            })
            .from(endpointSchemas)
            .innerJoin(schemas, eq(endpointSchemas.schemaId, schemas.id))
            .where(eq(endpointSchemas.endpointId, endpoint.id))
            .orderBy(asc(endpointSchemas.order));

          return {
            ...endpoint,
            apiTokens: associatedTokens,
            schemas: associatedSchemas,
          };
        })
      );

      return endpointsWithAssociations;
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Get a specific endpoint with associations
  app.get('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };

      const [endpoint] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!endpoint) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      // Get associated tokens
      const associatedTokens = await db
        .select({
          id: apiTokens.id,
          tokenName: apiTokens.tokenName,
          tokenPrefix: apiTokens.tokenPrefix,
        })
        .from(endpointApiTokens)
        .innerJoin(apiTokens, eq(endpointApiTokens.apiTokenId, apiTokens.id))
        .where(eq(endpointApiTokens.endpointId, id));

      // Get associated schemas
      const associatedSchemas = await db
        .select({
          id: schemas.id,
          name: schemas.name,
          order: endpointSchemas.order,
        })
        .from(endpointSchemas)
        .innerJoin(schemas, eq(endpointSchemas.schemaId, schemas.id))
        .where(eq(endpointSchemas.endpointId, id))
        .orderBy(asc(endpointSchemas.order));

      return {
        ...endpoint,
        apiTokens: associatedTokens,
        schemas: associatedSchemas,
      };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Create a new endpoint
  app.post('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = createEndpointSchema.parse(request.body);

      // Check if route already exists for this user
      const [existing] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.userId, userId), eq(endpoints.route, body.route)))
        .limit(1);

      if (existing) {
        reply.code(409).send({ message: 'Endpoint with this route already exists' });
        return;
      }

      const endpointId = uuidv4();
      
      const [newEndpoint] = await db
        .insert(endpoints)
        .values({
          id: endpointId,
          userId,
          routeName: body.routeName,
          route: body.route,
          rateLimit: body.rateLimit,
          rateLimitWindowMs: body.rateLimitWindowMs,
          allowedOrigins: body.allowedOrigins || [],
          description: body.description || null,
          isActive: body.isActive ?? true,
        })
        .returning();

      // Handle token associations
      if (body.apiTokenIds && body.apiTokenIds.length > 0) {
        // Verify tokens belong to user
        const userTokens = await db
          .select({ id: apiTokens.id })
          .from(apiTokens)
          .where(and(
            eq(apiTokens.userId, userId),
            inArray(apiTokens.id, body.apiTokenIds)
          ));

        if (userTokens.length !== body.apiTokenIds.length) {
          reply.code(400).send({ message: 'Some tokens do not exist or do not belong to you' });
          return;
        }

        await db.insert(endpointApiTokens).values(
          userTokens.map((token) => ({
            id: uuidv4(),
            endpointId,
            apiTokenId: token.id,
          }))
        );
      }

      // Handle schema associations
      if (body.schemaIds && body.schemaIds.length > 0) {
        // Verify schemas belong to user
        const userSchemas = await db
          .select({ id: schemas.id })
          .from(schemas)
          .where(and(
            eq(schemas.userId, userId),
            inArray(schemas.id, body.schemaIds)
          ));

        if (userSchemas.length !== body.schemaIds.length) {
          reply.code(400).send({ message: 'Some schemas do not exist or do not belong to you' });
          return;
        }

        await db.insert(endpointSchemas).values(
          userSchemas.map((schema, index) => ({
            id: uuidv4(),
            endpointId,
            schemaId: schema.id,
            order: index,
          }))
        );
      }

      // Return endpoint with associations
      const associatedTokens = await db
        .select({
          id: apiTokens.id,
          tokenName: apiTokens.tokenName,
          tokenPrefix: apiTokens.tokenPrefix,
        })
        .from(endpointApiTokens)
        .innerJoin(apiTokens, eq(endpointApiTokens.apiTokenId, apiTokens.id))
        .where(eq(endpointApiTokens.endpointId, endpointId));

      const associatedSchemas = await db
        .select({
          id: schemas.id,
          name: schemas.name,
          order: endpointSchemas.order,
        })
        .from(endpointSchemas)
        .innerJoin(schemas, eq(endpointSchemas.schemaId, schemas.id))
        .where(eq(endpointSchemas.endpointId, endpointId))
        .orderBy(asc(endpointSchemas.order));

      return {
        ...newEndpoint,
        apiTokens: associatedTokens,
        schemas: associatedSchemas,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Update an endpoint
  app.patch('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = updateEndpointSchema.parse(request.body);

      // Verify ownership
      const [existing] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!existing) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      // If route is being updated, check for conflicts
      if (body.route && body.route !== existing.route) {
        const [conflict] = await db
          .select()
          .from(endpoints)
          .where(and(eq(endpoints.userId, userId), eq(endpoints.route, body.route)))
          .limit(1);

        if (conflict) {
          reply.code(409).send({ message: 'Endpoint with this route already exists' });
          return;
        }
      }

      // Build update object with only provided fields
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (body.routeName !== undefined) updateData.routeName = body.routeName;
      if (body.route !== undefined) updateData.route = body.route;
      if (body.rateLimit !== undefined) updateData.rateLimit = body.rateLimit;
      if (body.rateLimitWindowMs !== undefined) updateData.rateLimitWindowMs = body.rateLimitWindowMs;
      if (body.allowedOrigins !== undefined) updateData.allowedOrigins = body.allowedOrigins;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      const [updated] = await db
        .update(endpoints)
        .set(updateData)
        .where(eq(endpoints.id, id))
        .returning();

      // Handle token associations if provided
      if (body.apiTokenIds !== undefined) {
        // Remove all existing associations
        await db.delete(endpointApiTokens).where(eq(endpointApiTokens.endpointId, id));

        // Add new associations
        if (body.apiTokenIds.length > 0) {
          const userTokens = await db
            .select({ id: apiTokens.id })
            .from(apiTokens)
            .where(and(
              eq(apiTokens.userId, userId),
              inArray(apiTokens.id, body.apiTokenIds)
            ));

          if (userTokens.length > 0) {
            await db.insert(endpointApiTokens).values(
              userTokens.map((token) => ({
                id: uuidv4(),
                endpointId: id,
                apiTokenId: token.id,
              }))
            );
          }
        }
      }

      // Handle schema associations if provided
      if (body.schemaIds !== undefined) {
        // Remove all existing associations
        await db.delete(endpointSchemas).where(eq(endpointSchemas.endpointId, id));

        // Add new associations
        if (body.schemaIds.length > 0) {
          const userSchemas = await db
            .select({ id: schemas.id })
            .from(schemas)
            .where(and(
              eq(schemas.userId, userId),
              inArray(schemas.id, body.schemaIds)
            ));

          if (userSchemas.length > 0) {
            await db.insert(endpointSchemas).values(
              userSchemas.map((schema, index) => ({
                id: uuidv4(),
                endpointId: id,
                schemaId: schema.id,
                order: index,
              }))
            );
          }
        }
      }

      // Return updated endpoint with associations
      const associatedTokens = await db
        .select({
          id: apiTokens.id,
          tokenName: apiTokens.tokenName,
          tokenPrefix: apiTokens.tokenPrefix,
        })
        .from(endpointApiTokens)
        .innerJoin(apiTokens, eq(endpointApiTokens.apiTokenId, apiTokens.id))
        .where(eq(endpointApiTokens.endpointId, id));

      const associatedSchemas = await db
        .select({
          id: schemas.id,
          name: schemas.name,
          order: endpointSchemas.order,
        })
        .from(endpointSchemas)
        .innerJoin(schemas, eq(endpointSchemas.schemaId, schemas.id))
        .where(eq(endpointSchemas.endpointId, id))
        .orderBy(asc(endpointSchemas.order));

      return {
        ...updated,
        apiTokens: associatedTokens,
        schemas: associatedSchemas,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Delete an endpoint
  app.delete('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };

      // Verify ownership
      const [existing] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!existing) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      await db.delete(endpoints).where(eq(endpoints.id, id));

      return { message: 'Endpoint deleted successfully' };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Add tokens to endpoint
  app.post('/:id/tokens', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = z.object({
        tokenIds: z.array(z.string().uuid()),
      }).parse(request.body);

      // Verify endpoint ownership
      const [endpoint] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!endpoint) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      // Verify tokens belong to user
      const userTokens = await db
        .select({ id: apiTokens.id })
        .from(apiTokens)
        .where(and(
          eq(apiTokens.userId, userId),
          inArray(apiTokens.id, body.tokenIds)
        ));

      if (userTokens.length !== body.tokenIds.length) {
        reply.code(400).send({ message: 'Some tokens do not exist or do not belong to you' });
        return;
      }

      // Check for existing associations
      const existing = await db
        .select()
        .from(endpointApiTokens)
        .where(and(
          eq(endpointApiTokens.endpointId, id),
          inArray(endpointApiTokens.apiTokenId, body.tokenIds)
        ));

      const existingTokenIds = new Set(existing.map((e) => e.apiTokenId));
      const newTokens = userTokens.filter((token) => !existingTokenIds.has(token.id));

      if (newTokens.length > 0) {
        await db.insert(endpointApiTokens).values(
          newTokens.map((token) => ({
            id: uuidv4(),
            endpointId: id,
            apiTokenId: token.id,
          }))
        );
      }

      return { message: 'Tokens associated successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Remove token from endpoint
  app.delete('/:id/tokens/:tokenId', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id, tokenId } = request.params as { id: string; tokenId: string };

      // Verify endpoint ownership
      const [endpoint] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!endpoint) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      await db
        .delete(endpointApiTokens)
        .where(and(
          eq(endpointApiTokens.endpointId, id),
          eq(endpointApiTokens.apiTokenId, tokenId)
        ));

      return { message: 'Token association removed' };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Add schemas to endpoint
  app.post('/:id/schemas', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = z.object({
        schemaIds: z.array(z.string().uuid()),
      }).parse(request.body);

      // Verify endpoint ownership
      const [endpoint] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!endpoint) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      // Verify schemas belong to user
      const userSchemas = await db
        .select({ id: schemas.id })
        .from(schemas)
        .where(and(
          eq(schemas.userId, userId),
          inArray(schemas.id, body.schemaIds)
        ));

      if (userSchemas.length !== body.schemaIds.length) {
        reply.code(400).send({ message: 'Some schemas do not exist or do not belong to you' });
        return;
      }

      // Get current max order
      const currentAssociations = await db
        .select({ order: endpointSchemas.order })
        .from(endpointSchemas)
        .where(eq(endpointSchemas.endpointId, id))
        .orderBy(asc(endpointSchemas.order));

      const maxOrder = currentAssociations.length > 0
        ? Math.max(...currentAssociations.map((a) => a.order))
        : -1;

      // Check for existing associations
      const existing = await db
        .select()
        .from(endpointSchemas)
        .where(and(
          eq(endpointSchemas.endpointId, id),
          inArray(endpointSchemas.schemaId, body.schemaIds)
        ));

      const existingSchemaIds = new Set(existing.map((e) => e.schemaId));
      const newSchemas = userSchemas.filter((schema) => !existingSchemaIds.has(schema.id));

      if (newSchemas.length > 0) {
        await db.insert(endpointSchemas).values(
          newSchemas.map((schema, index) => ({
            id: uuidv4(),
            endpointId: id,
            schemaId: schema.id,
            order: maxOrder + 1 + index,
          }))
        );
      }

      return { message: 'Schemas associated successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Remove schema from endpoint
  app.delete('/:id/schemas/:schemaId', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id, schemaId } = request.params as { id: string; schemaId: string };

      // Verify endpoint ownership
      const [endpoint] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!endpoint) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      await db
        .delete(endpointSchemas)
        .where(and(
          eq(endpointSchemas.endpointId, id),
          eq(endpointSchemas.schemaId, schemaId)
        ));

      return { message: 'Schema association removed' };
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Get call logs for an endpoint
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

      // Verify endpoint belongs to user
      const [endpoint] = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
        .limit(1);

      if (!endpoint) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }

      // Parse query parameters
      const page = parseInt(query.page || '1', 10);
      const limit = Math.min(parseInt(query.limit || '50', 10), 500);
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(callLogs.endpointId, id)];

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
