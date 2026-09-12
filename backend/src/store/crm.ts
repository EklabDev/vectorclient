import { v4 as uuidv4 } from 'uuid';
import { parseMaybeJson } from '../arcade/sql';
import { deleteById, findMany, findOne, insertDoc, updateById } from './documents';
import type { AgentWorkflowDoc, CrmPayloadSchemaDoc, CrmWebhookDoc, WorkflowStep } from './types';

export type WorkflowTrigger = { keywords: string[]; phrases: string[] };

export const Crm = {
  async listWebhooks(endpointId: string): Promise<CrmWebhookDoc[]> {
    return findMany<CrmWebhookDoc>('CrmWebhook', { endpointId });
  },
  async findWebhook(id: string): Promise<CrmWebhookDoc | null> {
    return findOne<CrmWebhookDoc>('CrmWebhook', { id });
  },
  async createWebhook(input: {
    endpointId: string;
    userId: string;
    name: string;
    url: string;
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    enabled?: boolean;
  }): Promise<CrmWebhookDoc> {
    const now = new Date().toISOString();
    return insertDoc<CrmWebhookDoc>('CrmWebhook', {
      id: uuidv4(),
      endpointId: input.endpointId,
      userId: input.userId,
      name: input.name,
      url: input.url,
      method: input.method || 'POST',
      headersJson: JSON.stringify(input.headers || {}),
      timeoutMs: input.timeoutMs ?? 10000,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
  async updateWebhook(id: string, fields: Partial<CrmWebhookDoc> & { headers?: Record<string, string> }): Promise<CrmWebhookDoc | null> {
    const patch: Record<string, unknown> = { ...fields };
    if (fields.headers) patch.headersJson = JSON.stringify(fields.headers);
    delete patch.headers;
    return updateById<CrmWebhookDoc>('CrmWebhook', id, patch);
  },
  async removeWebhook(id: string): Promise<void> {
    await deleteById('CrmWebhook', id);
  },
  async getPayloadSchema(endpointId: string): Promise<CrmPayloadSchemaDoc | null> {
    return findOne<CrmPayloadSchemaDoc>('CrmPayloadSchema', { endpointId });
  },
  async upsertPayloadSchema(endpointId: string, userId: string, jsonSchema: object): Promise<CrmPayloadSchemaDoc> {
    const existing = await this.getPayloadSchema(endpointId);
    const encoded = JSON.stringify(jsonSchema);
    if (existing) {
      const updated = await updateById<CrmPayloadSchemaDoc>('CrmPayloadSchema', existing.id, { jsonSchema: encoded });
      return updated!;
    }
    const now = new Date().toISOString();
    return insertDoc<CrmPayloadSchemaDoc>('CrmPayloadSchema', {
      id: uuidv4(),
      endpointId,
      userId,
      jsonSchema: encoded,
      createdAt: now,
      updatedAt: now,
    });
  },
  async listWorkflows(endpointId: string): Promise<AgentWorkflowDoc[]> {
    return findMany<AgentWorkflowDoc>('AgentWorkflow', { endpointId });
  },
  async findWorkflow(id: string): Promise<AgentWorkflowDoc | null> {
    return findOne<AgentWorkflowDoc>('AgentWorkflow', { id });
  },
  async enabledWorkflows(endpointId: string): Promise<AgentWorkflowDoc[]> {
    return findMany<AgentWorkflowDoc>('AgentWorkflow', { endpointId, enabled: true });
  },
  async createWorkflow(input: {
    endpointId: string;
    userId: string;
    webhookId: string | null;
    name: string;
    trigger: WorkflowTrigger;
    steps: WorkflowStep[];
    confirmMessage?: string;
    enabled?: boolean;
  }): Promise<AgentWorkflowDoc> {
    const now = new Date().toISOString();
    return insertDoc<AgentWorkflowDoc>('AgentWorkflow', {
      id: uuidv4(),
      endpointId: input.endpointId,
      userId: input.userId,
      webhookId: input.webhookId,
      name: input.name,
      triggerJson: JSON.stringify(input.trigger),
      stepsJson: JSON.stringify(input.steps),
      confirmMessage: input.confirmMessage || 'Thanks — we received your details.',
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
  async updateWorkflow(
    id: string,
    fields: Partial<AgentWorkflowDoc> & { trigger?: WorkflowTrigger; steps?: WorkflowStep[] }
  ): Promise<AgentWorkflowDoc | null> {
    const patch: Record<string, unknown> = { ...fields };
    if (fields.trigger) patch.triggerJson = JSON.stringify(fields.trigger);
    if (fields.steps) patch.stepsJson = JSON.stringify(fields.steps);
    delete patch.trigger;
    delete patch.steps;
    return updateById<AgentWorkflowDoc>('AgentWorkflow', id, patch);
  },
  async removeWorkflow(id: string): Promise<void> {
    await deleteById('AgentWorkflow', id);
  },
};

export function parseTrigger(json: string): WorkflowTrigger {
  const parsed = parseMaybeJson<Partial<WorkflowTrigger>>(json, {});
  return { keywords: parsed.keywords || [], phrases: parsed.phrases || [] };
}

export function parseSteps(json: string): WorkflowStep[] {
  return parseMaybeJson<WorkflowStep[]>(json, []);
}

export function parseWebhookHeaders(json: string): Record<string, string> {
  return parseMaybeJson<Record<string, string>>(json, {});
}

export function parseJsonSchema(json: string): Record<string, unknown> {
  return parseMaybeJson<Record<string, unknown>>(json, { type: 'object', properties: {} });
}
