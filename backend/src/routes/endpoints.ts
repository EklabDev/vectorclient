import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { Endpoints, parseTopicFilter } from '../store/endpoints';
import { Tokens } from '../store/tokens';
import { Schemas } from '../store/schemas';
import { Logs } from '../store/logs';
import { DEFAULT_TOPIC_FILTER } from '../store/types';

const topicFilterSchema = z
  .object({
    enabled: z.boolean().optional(),
    minSimilarity: z.number().min(0).max(1).optional(),
    offTopicReply: z.string().min(1).optional(),
  })
  .optional();

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
  topicFilter: topicFilterSchema,
});

const updateEndpointSchema = createEndpointSchema.partial();

async function withAssociations(endpointId: string) {
  const endpoint = await Endpoints.findById(endpointId);
  if (!endpoint) return null;
  const tokenLinks = await Endpoints.tokenLinks(endpointId);
  const schemaLinks = await Endpoints.schemaLinks(endpointId);
  const tokens = await Promise.all(tokenLinks.map((l) => Tokens.findById(l.apiTokenId)));
  const schemaRows = await Promise.all(schemaLinks.map((l) => Schemas.findById(l.schemaId)));
  return {
    ...endpoint,
    topicFilter: parseTopicFilter(endpoint.topicFilterJson),
    apiTokens: tokens.filter(Boolean).map((t) => ({
      id: t!.id,
      tokenName: t!.tokenName,
      tokenPrefix: t!.tokenPrefix,
    })),
    schemas: schemaRows
      .map((s, i) => (s ? { id: s.id, name: s.name, order: schemaLinks[i].order } : null))
      .filter(Boolean),
  };
}

export async function endpointRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const list = await Endpoints.listByUser(userId);
      return Promise.all(list.map((e) => withAssociations(e.id)));
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.get('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const existing = await Endpoints.findByIdAndUser(id, userId);
      if (!existing) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }
      return withAssociations(id);
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.post('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = createEndpointSchema.parse(request.body);
      const conflict = await Endpoints.findByRoute(userId, body.route);
      if (conflict) {
        reply.code(409).send({ message: 'Endpoint with this route already exists' });
        return;
      }
      if (body.apiTokenIds.length) {
        const toks = await Tokens.findByIds(userId, body.apiTokenIds);
        if (toks.length !== body.apiTokenIds.length) {
          reply.code(400).send({ message: 'Some tokens do not exist or do not belong to you' });
          return;
        }
      }
      if (body.schemaIds.length) {
        const sch = await Schemas.findByIds(userId, body.schemaIds);
        if (sch.length !== body.schemaIds.length) {
          reply.code(400).send({ message: 'Some schemas do not exist or do not belong to you' });
          return;
        }
      }
      const created = await Endpoints.create({
        userId,
        routeName: body.routeName,
        route: body.route,
        rateLimit: body.rateLimit,
        rateLimitWindowMs: body.rateLimitWindowMs,
        allowedOrigins: body.allowedOrigins,
        description: body.description || null,
        isActive: body.isActive ?? true,
        topicFilter: { ...DEFAULT_TOPIC_FILTER, ...body.topicFilter },
      });
      await Endpoints.setTokenLinks(created.id, body.apiTokenIds);
      await Endpoints.setSchemaLinks(created.id, body.schemaIds);
      return withAssociations(created.id);
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
      const body = updateEndpointSchema.parse(request.body);
      const existing = await Endpoints.findByIdAndUser(id, userId);
      if (!existing) {
        reply.code(404).send({ message: 'Endpoint not found' });
        return;
      }
      if (body.route && body.route !== existing.route) {
        const conflict = await Endpoints.findByRoute(userId, body.route);
        if (conflict) {
          reply.code(409).send({ message: 'Endpoint with this route already exists' });
          return;
        }
      }
      await Endpoints.update(id, {
        ...(body.routeName !== undefined && { routeName: body.routeName }),
        ...(body.route !== undefined && { route: body.route }),
        ...(body.rateLimit !== undefined && { rateLimit: body.rateLimit }),
        ...(body.rateLimitWindowMs !== undefined && { rateLimitWindowMs: body.rateLimitWindowMs }),
        ...(body.allowedOrigins !== undefined && { allowedOrigins: body.allowedOrigins }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.topicFilter !== undefined && {
          topicFilter: { ...parseTopicFilter(existing.topicFilterJson), ...body.topicFilter },
        }),
      });
      if (body.apiTokenIds !== undefined) await Endpoints.setTokenLinks(id, body.apiTokenIds);
      if (body.schemaIds !== undefined) await Endpoints.setSchemaLinks(id, body.schemaIds);
      return withAssociations(id);
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
    const existing = await Endpoints.findByIdAndUser(id, userId);
    if (!existing) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    await Endpoints.remove(id);
    return { message: 'Endpoint deleted successfully' };
  });

  app.post('/:id/tokens', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const body = z.object({ tokenIds: z.array(z.string().uuid()) }).parse(request.body);
    const endpoint = await Endpoints.findByIdAndUser(id, userId);
    if (!endpoint) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const toks = await Tokens.findByIds(userId, body.tokenIds);
    if (toks.length !== body.tokenIds.length) {
      reply.code(400).send({ message: 'Some tokens do not exist or do not belong to you' });
      return;
    }
    await Endpoints.addTokenLinks(id, body.tokenIds);
    return { message: 'Tokens associated successfully' };
  });

  app.delete('/:id/tokens/:tokenId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, tokenId } = request.params as { id: string; tokenId: string };
    const endpoint = await Endpoints.findByIdAndUser(id, userId);
    if (!endpoint) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    await Endpoints.removeTokenLink(id, tokenId);
    return { message: 'Token association removed' };
  });

  app.post('/:id/schemas', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const body = z.object({ schemaIds: z.array(z.string().uuid()) }).parse(request.body);
    const endpoint = await Endpoints.findByIdAndUser(id, userId);
    if (!endpoint) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const sch = await Schemas.findByIds(userId, body.schemaIds);
    if (sch.length !== body.schemaIds.length) {
      reply.code(400).send({ message: 'Some schemas do not exist or do not belong to you' });
      return;
    }
    await Endpoints.addSchemaLinks(id, body.schemaIds);
    return { message: 'Schemas associated successfully' };
  });

  app.delete('/:id/schemas/:schemaId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, schemaId } = request.params as { id: string; schemaId: string };
    const endpoint = await Endpoints.findByIdAndUser(id, userId);
    if (!endpoint) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    await Endpoints.removeSchemaLink(id, schemaId);
    return { message: 'Schema association removed' };
  });

  app.get('/:id/logs', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string | undefined>;
    const endpoint = await Endpoints.findByIdAndUser(id, userId);
    if (!endpoint) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '50', 10), 500);
    const { logs, total } = await Logs.list({
      endpointId: id,
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
  });
}
