import { RedisService } from '../redisService';
import { Crm, parseJsonSchema, parseSteps, parseTrigger, parseWebhookHeaders } from '../../store/crm';
import type { AgentWorkflowDoc, WorkflowStep } from '../../store/types';

export type WorkflowState = {
  workflowId: string;
  slots: Record<string, string>;
};

const TTL = 60 * 60 * 12;
const memory = new Map<string, WorkflowState>();

function memKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}

function stateKey(conversationId: string): string {
  return `workflow:${conversationId}`;
}

export async function loadWorkflowState(
  userId: string,
  conversationId: string
): Promise<WorkflowState | null> {
  if (RedisService.isEnabled()) {
    const raw = await RedisService.get(userId, stateKey(conversationId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WorkflowState;
    } catch {
      return null;
    }
  }
  return memory.get(memKey(userId, conversationId)) ?? null;
}

export async function saveWorkflowState(
  userId: string,
  conversationId: string,
  state: WorkflowState
): Promise<void> {
  if (RedisService.isEnabled()) {
    await RedisService.set(userId, stateKey(conversationId), JSON.stringify(state), TTL);
    return;
  }
  memory.set(memKey(userId, conversationId), state);
}

export async function clearWorkflowState(userId: string, conversationId: string): Promise<void> {
  if (RedisService.isEnabled()) {
    await RedisService.del(userId, stateKey(conversationId));
    return;
  }
  memory.delete(memKey(userId, conversationId));
}

export function resetWorkflowMemory(): void {
  memory.clear();
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

export function matchWorkflowTrigger(message: string, workflows: AgentWorkflowDoc[]): AgentWorkflowDoc | null {
  const lower = message.toLowerCase();
  for (const wf of workflows) {
    const trigger = parseTrigger(wf.triggerJson);
    if (trigger.phrases.some((p) => p && lower.includes(p.toLowerCase()))) return wf;
    if (trigger.keywords.some((k) => k && new RegExp(`\\b${escapeRe(k)}\\b`, 'i').test(message))) return wf;
  }
  return null;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSlots(message: string, steps: WorkflowStep[], current: Record<string, string>): Record<string, string> {
  const next = { ...current };
  const email = message.match(EMAIL_RE)?.[0];
  const phone = message.match(PHONE_RE)?.[0];
  for (const step of steps) {
    if (next[step.field]) continue;
    const field = step.field.toLowerCase();
    if (field.includes('email') && email) next[step.field] = email;
    else if ((field.includes('phone') || field.includes('mobile')) && phone) next[step.field] = phone.trim();
  }
  const missing = steps.filter((s) => !next[s.field]);
  const leftover = message
    .replace(EMAIL_RE, '')
    .replace(PHONE_RE, '')
    .trim();
  if (missing[0] && leftover && leftover.length < 120 && !leftover.includes('?')) {
    next[missing[0].field] = leftover;
  }
  return next;
}

export function nextMissingStep(steps: WorkflowStep[], slots: Record<string, string>): WorkflowStep | null {
  return steps.find((s) => s.required && !slots[s.field]?.trim()) || null;
}

export function validateAgainstSchema(
  schema: Record<string, unknown>,
  slots: Record<string, string>
): { ok: true } | { ok: false; message: string } {
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const key of required) {
    if (!slots[key]?.trim()) return { ok: false, message: `Missing required field: ${key}` };
  }
  const properties = (schema.properties || {}) as Record<string, { format?: string; type?: string }>;
  for (const [key, spec] of Object.entries(properties)) {
    const value = slots[key];
    if (!value) continue;
    if (spec.format === 'email' && !EMAIL_RE.test(value)) {
      return { ok: false, message: 'Please provide a valid email address.' };
    }
  }
  return { ok: true };
}

export async function postCrmWebhook(
  webhookId: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: string }> {
  const webhook = await Crm.findWebhook(webhookId);
  if (!webhook || !webhook.enabled) {
    return { ok: false, status: 0, body: 'Webhook not found or disabled' };
  }
  const headers = parseWebhookHeaders(webhook.headersJson);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), webhook.timeoutMs || 10000);
  try {
    const res = await fetch(webhook.url, {
      method: webhook.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : 'Webhook failed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function runCollectionTurn(input: {
  userId: string;
  endpointId: string;
  conversationId: string;
  message: string;
  state: WorkflowState | null;
}): Promise<{ handled: boolean; reply?: string; completed?: boolean }> {
  const workflows = await Crm.enabledWorkflows(input.endpointId);
  if (workflows.length === 0) return { handled: false };

  let state = input.state;
  let workflow = state ? await Crm.findWorkflow(state.workflowId) : null;
  if (!workflow || !workflow.enabled) {
    workflow = matchWorkflowTrigger(input.message, workflows);
    if (!workflow) return { handled: false };
    state = { workflowId: workflow.id, slots: {} };
  }

  const steps = parseSteps(workflow.stepsJson);
  const slots = extractSlots(input.message, steps, state.slots);
  const missing = nextMissingStep(steps, slots);
  if (missing) {
    await saveWorkflowState(input.userId, input.conversationId, { workflowId: workflow.id, slots });
    return { handled: true, reply: missing.prompt };
  }

  const schemaDoc = await Crm.getPayloadSchema(input.endpointId);
  const schema = schemaDoc ? parseJsonSchema(schemaDoc.jsonSchema) : { type: 'object', properties: {} };
  const valid = validateAgainstSchema(schema, slots);
  if (!valid.ok) {
    await saveWorkflowState(input.userId, input.conversationId, { workflowId: workflow.id, slots });
    return { handled: true, reply: valid.message };
  }

  if (!workflow.webhookId) {
    await clearWorkflowState(input.userId, input.conversationId);
    return { handled: true, reply: workflow.confirmMessage, completed: true };
  }

  const posted = await postCrmWebhook(workflow.webhookId, {
    ...slots,
    user_id: input.userId,
    endpoint_id: input.endpointId,
    conversation_id: input.conversationId,
  });
  if (!posted.ok) {
    await saveWorkflowState(input.userId, input.conversationId, { workflowId: workflow.id, slots });
    return {
      handled: true,
      reply: 'I collected your details but could not reach the CRM. Please try again in a moment.',
    };
  }
  await clearWorkflowState(input.userId, input.conversationId);
  return { handled: true, reply: workflow.confirmMessage, completed: true };
}
