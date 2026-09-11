import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { Endpoints } from '../store/endpoints';
import { Crm, parseJsonSchema, parseSteps, parseTrigger, parseWebhookHeaders } from '../store/crm';
import { postCrmWebhook } from '../services/agent/crmWorkflow';

const webhookBody = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  method: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});

const schemaBody = z.object({
  jsonSchema: z.record(z.string(), z.unknown()),
});

const workflowBody = z.object({
  name: z.string().min(1),
  webhookId: z.string().uuid().nullable().optional(),
  trigger: z.object({
    keywords: z.array(z.string()).default([]),
    phrases: z.array(z.string()).default([]),
  }),
  steps: z.array(
    z.object({
      field: z.string().min(1),
      prompt: z.string().min(1),
      required: z.boolean().default(true),
    })
  ),
  confirmMessage: z.string().optional(),
  enabled: z.boolean().optional(),
});

async function ownedEndpoint(userId: string, id: string) {
  return Endpoints.findByIdAndUser(id, userId);
}

export async function crmRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/:id/crm/webhooks', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const rows = await Crm.listWebhooks(id);
    return rows.map((w) => ({ ...w, headers: parseWebhookHeaders(w.headersJson) }));
  });

  app.post('/:id/crm/webhooks', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const body = webhookBody.parse(request.body);
    return Crm.createWebhook({ endpointId: id, userId, ...body });
  });

  app.patch('/:id/crm/webhooks/:webhookId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, webhookId } = request.params as { id: string; webhookId: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const body = webhookBody.partial().parse(request.body);
    return Crm.updateWebhook(webhookId, body);
  });

  app.delete('/:id/crm/webhooks/:webhookId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, webhookId } = request.params as { id: string; webhookId: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    await Crm.removeWebhook(webhookId);
    return { ok: true };
  });

  app.post('/:id/crm/webhooks/:webhookId/test', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, webhookId } = request.params as { id: string; webhookId: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const sample = (request.body as { payload?: Record<string, unknown> })?.payload || { test: true };
    return postCrmWebhook(webhookId, { ...sample, user_id: userId, endpoint_id: id });
  });

  app.get('/:id/crm/schema', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const row = await Crm.getPayloadSchema(id);
    return { jsonSchema: row ? parseJsonSchema(row.jsonSchema) : { type: 'object', properties: {} } };
  });

  app.put('/:id/crm/schema', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const body = schemaBody.parse(request.body);
    const row = await Crm.upsertPayloadSchema(id, userId, body.jsonSchema);
    return { jsonSchema: parseJsonSchema(row.jsonSchema) };
  });

  app.get('/:id/crm/workflows', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const rows = await Crm.listWorkflows(id);
    return rows.map((w) => ({
      ...w,
      trigger: parseTrigger(w.triggerJson),
      steps: parseSteps(w.stepsJson),
    }));
  });

  app.post('/:id/crm/workflows', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const body = workflowBody.parse(request.body);
    return Crm.createWorkflow({
      endpointId: id,
      userId,
      webhookId: body.webhookId ?? null,
      name: body.name,
      trigger: body.trigger,
      steps: body.steps,
      confirmMessage: body.confirmMessage,
      enabled: body.enabled,
    });
  });

  app.patch('/:id/crm/workflows/:workflowId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, workflowId } = request.params as { id: string; workflowId: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    const body = workflowBody.partial().parse(request.body);
    return Crm.updateWorkflow(workflowId, body);
  });

  app.delete('/:id/crm/workflows/:workflowId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id, workflowId } = request.params as { id: string; workflowId: string };
    if (!(await ownedEndpoint(userId, id))) {
      reply.code(404).send({ message: 'Endpoint not found' });
      return;
    }
    await Crm.removeWorkflow(workflowId);
    return { ok: true };
  });
}
