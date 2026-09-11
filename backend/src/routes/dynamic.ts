import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { Endpoints } from '../store/endpoints';
import { Schemas } from '../store/schemas';
import {
  authenticateEndpointRequest,
  logEndpointCall,
  requestMeta,
} from '../utils/endpointAuth';

export async function dynamicRoutes(app: FastifyInstance) {
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

      const links = await Endpoints.schemaLinks(auth.endpoint.id);
      const firstSchema = links[0] ? await Schemas.findById(links[0].schemaId) : null;
      const original = (request.body && typeof request.body === 'object' ? request.body : {}) as Record<
        string,
        unknown
      >;
      const forwardingBody: Record<string, unknown> = {
        user_id: params.user_id,
        endpoint_id: params.endpoint_id,
        ...(firstSchema ? { schema_id: firstSchema.id } : {}),
        ...(firstSchema?.systemPrompt ? { system_prompt: firstSchema.systemPrompt } : {}),
      };
      for (const [k, v] of Object.entries(original)) {
        if (!['user_id', 'endpoint_id', 'schema_id'].includes(k)) {
          forwardingBody[k] = v;
        }
      }

      const targetUrl = auth.endpoint.route;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        const message = 'Route must be a full URL (starting with http:// or https://)';
        reply.code(400).send({ message });
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

      const forwardResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.authorization && { Authorization: String(request.headers.authorization) }),
          ...(request.headers['user-agent'] && { 'User-Agent': String(request.headers['user-agent']) }),
        },
        body: JSON.stringify(forwardingBody),
      });
      const responseText = await forwardResponse.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = responseText;
      }
      reply.code(forwardResponse.status).send(parsed);
      await logEndpointCall({
        endpointId: auth.endpoint.id,
        apiTokenId,
        method: meta.method,
        path: meta.path,
        status: forwardResponse.status,
        requestBody: request.body,
        responseBody: responseText,
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
