import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../config/database';
import { endpointSchemas, schemas } from '../database/schema';
import { eq, and, asc } from 'drizzle-orm';
import { WeaviateService } from '../services/weaviateService';
import { AgentService } from '../services/agent/agentService';
import type { KnowledgeCollection } from '../services/agent/types';
import {
  authenticateEndpointRequest,
  logEndpointCall,
  requestMeta,
} from '../utils/endpointAuth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const agentBodySchema = z
  .object({
    message: z.string().min(1).max(16000),
    conversation_id: z.string().uuid().optional(),
  })
  .passthrough();

async function loadLinkedCollections(endpointId: string): Promise<KnowledgeCollection[]> {
  const rows = await db
    .select({
      schemaId: schemas.id,
      schemaName: schemas.name,
      weaviateCollectionId: schemas.weaviateCollectionId,
      systemPrompt: schemas.systemPrompt,
      isPublished: schemas.isPublished,
    })
    .from(endpointSchemas)
    .innerJoin(schemas, eq(endpointSchemas.schemaId, schemas.id))
    .where(
      and(eq(endpointSchemas.endpointId, endpointId), eq(schemas.isPublished, true))
    )
    .orderBy(asc(endpointSchemas.order));

  const collections: KnowledgeCollection[] = [];
  for (const row of rows) {
    if (!row.weaviateCollectionId) continue;
    collections.push({
      schemaId: row.schemaId,
      schemaName: row.schemaName,
      className: WeaviateService.resolveClassName(row.schemaId, row.weaviateCollectionId),
      systemPrompt: row.systemPrompt,
      sourceType: 'schema',
    });
  }

  // Optional scrape collections (Phase 4) — ignore if module/table missing
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadScrapeCollectionsForEndpoint } = require('../services/scrape/scrapeCollections') as {
      loadScrapeCollectionsForEndpoint: (endpointId: string) => Promise<KnowledgeCollection[]>;
    };
    const scrape = await loadScrapeCollectionsForEndpoint(endpointId);
    collections.push(...scrape);
  } catch {
    /* scrape not available yet */
  }

  return collections;
}

export async function agentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', rateLimitMiddleware);

  // POST /api/v1/agents/:endpoint_id/:user_id
  app.post('/:endpoint_id/:user_id', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const params = request.params as { endpoint_id: string; user_id: string };
    const meta = requestMeta(request);
    let apiTokenId: string | null = null;
    let endpointIdForLog: string | null = null;

    try {
      const auth = await authenticateEndpointRequest(
        request,
        params.endpoint_id,
        params.user_id
      );
      endpointIdForLog = auth.endpoint?.id ?? null;
      apiTokenId = auth.apiTokenId;

      if (!auth.ok) {
        reply.code(auth.statusCode).send({ message: auth.message });
        if (auth.endpoint) {
          await logEndpointCall({
            endpointId: auth.endpoint.id,
            apiTokenId: auth.apiTokenId,
            method: meta.method,
            path: meta.path,
            status: auth.statusCode,
            requestBody: request.body,
            responseBody: null,
            responseTime: Date.now() - startTime,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            errorMessage: auth.message,
          });
        }
        return;
      }

      const parsed = agentBodySchema.safeParse(request.body);
      if (!parsed.success) {
        const message = 'Request body must include a non-empty message string';
        reply.code(400).send({ message, issues: parsed.error.issues });
        await logEndpointCall({
          endpointId: auth.endpoint.id,
          apiTokenId,
          method: meta.method,
          path: meta.path,
          status: 400,
          requestBody: request.body,
          responseBody: null,
          responseTime: Date.now() - startTime,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          errorMessage: message,
        });
        return;
      }

      const { message, conversation_id, ...rest } = parsed.data;
      const reserved = new Set(['message', 'conversation_id']);
      const extraContext: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (!reserved.has(k)) extraContext[k] = v;
      }

      const collections = await loadLinkedCollections(auth.endpoint.id);
      const result = await AgentService.run({
        userId: params.user_id,
        endpointId: auth.endpoint.id,
        message,
        conversationId: conversation_id,
        extraContext,
        collections,
      });

      const responseBody = {
        reply: result.reply,
        conversation_id: result.conversationId,
      };
      reply.code(200).send(responseBody);

      await logEndpointCall({
        endpointId: auth.endpoint.id,
        apiTokenId,
        method: meta.method,
        path: meta.path,
        status: 200,
        requestBody: request.body,
        responseBody: {
          ...responseBody,
          tool_calls: result.toolCalls,
        },
        responseTime: Date.now() - startTime,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        errorMessage: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ message: errorMessage || 'Internal server error' });
      if (endpointIdForLog) {
        await logEndpointCall({
          endpointId: endpointIdForLog,
          apiTokenId,
          method: meta.method,
          path: meta.path,
          status: 500,
          requestBody: request.body,
          responseBody: null,
          responseTime: Date.now() - startTime,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          errorMessage,
        });
      }
    }
  });
}
