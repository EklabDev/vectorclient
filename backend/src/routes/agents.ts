import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Endpoints, parseTopicFilter } from '../store/endpoints';
import { Schemas } from '../store/schemas';
import { AgentService } from '../services/agent/agentService';
import type { KnowledgeCollection } from '../services/agent/types';
import { loadScrapeCollectionsForEndpoint } from '../services/scrape/scrapeCollections';
import { evaluateTopicGate } from '../services/agent/topicGate';
import { loadWorkflowState, runCollectionTurn } from '../services/agent/crmWorkflow';
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
  const links = await Endpoints.schemaLinks(endpointId);
  const collections: KnowledgeCollection[] = [];
  for (const link of links) {
    const schema = await Schemas.findById(link.schemaId);
    if (!schema?.isPublished) continue;
    collections.push({
      schemaId: schema.id,
      schemaName: schema.name,
      className: schema.id,
      systemPrompt: schema.systemPrompt,
      sourceType: 'schema',
    });
  }
  try {
    collections.push(...(await loadScrapeCollectionsForEndpoint(endpointId)));
  } catch {
    /* scrape optional */
  }
  return collections;
}

export async function agentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', rateLimitMiddleware);

  app.post('/:endpoint_id/:user_id', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const params = request.params as { endpoint_id: string; user_id: string };
    const meta = requestMeta(request);
    let apiTokenId: string | null = null;
    let endpointIdForLog: string | null = null;

    try {
      const auth = await authenticateEndpointRequest(request, params.endpoint_id, params.user_id);
      endpointIdForLog = auth.endpoint?.id ?? null;
      apiTokenId = auth.apiTokenId;
      if (!auth.ok) {
        reply.code(auth.statusCode).send({ message: auth.message });
        if (auth.endpoint) {
          await logEndpointCall({
            endpointId: auth.endpoint.id,
            apiTokenId,
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
      const extraContext: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (k !== 'message' && k !== 'conversation_id') extraContext[k] = v;
      }

      const conversationId = conversation_id?.trim() || uuidv4();
      const wfState = await loadWorkflowState(params.user_id, conversationId);
      const collection = await runCollectionTurn({
        userId: params.user_id,
        endpointId: auth.endpoint.id,
        conversationId,
        message,
        state: wfState,
      });
      if (collection.handled && collection.reply) {
        const responseBody = {
          reply: collection.reply,
          conversation_id: conversationId,
          filtered: false,
          workflow: true,
        };
        reply.code(200).send(responseBody);
        await logEndpointCall({
          endpointId: auth.endpoint.id,
          apiTokenId,
          method: meta.method,
          path: meta.path,
          status: 200,
          requestBody: request.body,
          responseBody,
          responseTime: Date.now() - startTime,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          errorMessage: null,
        });
        return;
      }

      const collections = await loadLinkedCollections(auth.endpoint.id);
      const topic = await evaluateTopicGate({
        userId: params.user_id,
        message,
        schemaIds: collections.filter((c) => c.sourceType === 'schema').map((c) => c.schemaId),
        filter: parseTopicFilter(auth.endpoint.topicFilterJson),
      });
      if (!topic.allow) {
        const responseBody = { reply: topic.reply, conversation_id: conversationId, filtered: true };
        reply.code(200).send(responseBody);
        await logEndpointCall({
          endpointId: auth.endpoint.id,
          apiTokenId,
          method: meta.method,
          path: meta.path,
          status: 200,
          requestBody: request.body,
          responseBody,
          responseTime: Date.now() - startTime,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          errorMessage: null,
        });
        return;
      }

      const result = await AgentService.run({
        userId: params.user_id,
        endpointId: auth.endpoint.id,
        message,
        conversationId,
        extraContext,
        collections,
      });
      const responseBody = { reply: result.reply, conversation_id: result.conversationId, filtered: false };
      reply.code(200).send(responseBody);
      await logEndpointCall({
        endpointId: auth.endpoint.id,
        apiTokenId,
        method: meta.method,
        path: meta.path,
        status: 200,
        requestBody: request.body,
        responseBody: { ...responseBody, tool_calls: result.toolCalls },
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
