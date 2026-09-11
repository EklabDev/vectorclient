import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractSlots,
  validateAgainstSchema,
  nextMissingStep,
  matchWorkflowTrigger,
  resetWorkflowMemory,
  runCollectionTurn,
} from './crmWorkflow';
import type { AgentWorkflowDoc, WorkflowStep } from '../../store/types';

const findWorkflow = vi.fn();
const enabledWorkflows = vi.fn();
const getPayloadSchema = vi.fn();
const findWebhook = vi.fn();

vi.mock('../../store/crm', async () => {
  const actual = await vi.importActual<typeof import('../../store/crm')>('../../store/crm');
  return {
    ...actual,
    Crm: {
      findWorkflow: (...args: unknown[]) => findWorkflow(...args),
      enabledWorkflows: (...args: unknown[]) => enabledWorkflows(...args),
      getPayloadSchema: (...args: unknown[]) => getPayloadSchema(...args),
      findWebhook: (...args: unknown[]) => findWebhook(...args),
    },
  };
});

const steps: WorkflowStep[] = [
  { field: 'name', prompt: 'What is your name?', required: true },
  { field: 'email', prompt: 'What is your email?', required: true },
  { field: 'phone', prompt: 'What is your phone?', required: true },
];

const workflow: AgentWorkflowDoc = {
  id: 'wf-1',
  endpointId: 'ep-1',
  userId: 'u1',
  webhookId: 'hook-1',
  name: 'Lead',
  triggerJson: JSON.stringify({ keywords: ['enroll'], phrases: ['sign up'] }),
  stepsJson: JSON.stringify(steps),
  confirmMessage: 'Thanks, we got it.',
  enabled: true,
  createdAt: '',
  updatedAt: '',
};

describe('CRM slot filling', () => {
  it('extracts email and phone from a freeform message', () => {
    const slots = extractSlots('Jane jane@test.com 555-123-4567', steps, {});
    expect(slots.email).toBe('jane@test.com');
    expect(slots.phone).toContain('555');
  });

  it('rejects invalid email against JSON Schema', () => {
    const result = validateAgainstSchema(
      { required: ['email'], properties: { email: { format: 'email' } } },
      { email: 'not-an-email' }
    );
    expect(result.ok).toBe(false);
  });

  it('does not POST until required fields are filled', () => {
    expect(nextMissingStep(steps, { name: 'Jane' })?.field).toBe('email');
  });

  it('matches enroll trigger phrases', () => {
    expect(matchWorkflowTrigger('I want to sign up', [workflow])?.id).toBe('wf-1');
    expect(matchWorkflowTrigger('what time is class', [workflow])).toBeNull();
  });
});

describe('runCollectionTurn', () => {
  beforeEach(() => {
    resetWorkflowMemory();
    findWorkflow.mockReset();
    enabledWorkflows.mockReset();
    getPayloadSchema.mockReset();
    findWebhook.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => 'ok' }))
    );
  });

  it('starts on trigger and asks the next field', async () => {
    enabledWorkflows.mockResolvedValue([workflow]);
    findWorkflow.mockResolvedValue(workflow);
    const result = await runCollectionTurn({
      userId: 'u1',
      endpointId: 'ep-1',
      conversationId: 'c1',
      message: 'I want to sign up',
      state: null,
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toBe('What is your name?');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('POSTs to the webhook once required fields are complete', async () => {
    enabledWorkflows.mockResolvedValue([workflow]);
    findWorkflow.mockResolvedValue(workflow);
    getPayloadSchema.mockResolvedValue({
      jsonSchema: JSON.stringify({
        required: ['name', 'email', 'phone'],
        properties: { email: { format: 'email' } },
      }),
    });
    findWebhook.mockResolvedValue({
      id: 'hook-1',
      enabled: true,
      url: 'https://crm.example.com/lead',
      method: 'POST',
      headersJson: '{}',
      timeoutMs: 5000,
    });

    await runCollectionTurn({
      userId: 'u1',
      endpointId: 'ep-1',
      conversationId: 'c1',
      message: 'sign up',
      state: null,
    });
    await runCollectionTurn({
      userId: 'u1',
      endpointId: 'ep-1',
      conversationId: 'c1',
      message: 'Jane Doe',
      state: { workflowId: 'wf-1', slots: {} },
    });
    const done = await runCollectionTurn({
      userId: 'u1',
      endpointId: 'ep-1',
      conversationId: 'c1',
      message: 'jane@test.com 555-111-2222',
      state: { workflowId: 'wf-1', slots: { name: 'Jane Doe' } },
    });
    expect(done.completed).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(body.email).toBe('jane@test.com');
    expect(body.user_id).toBe('u1');
  });

  it('keeps slots when the CRM webhook returns 5xx', async () => {
    enabledWorkflows.mockResolvedValue([workflow]);
    findWorkflow.mockResolvedValue(workflow);
    getPayloadSchema.mockResolvedValue({
      jsonSchema: JSON.stringify({
        required: ['name', 'email', 'phone'],
        properties: { email: { format: 'email' } },
      }),
    });
    findWebhook.mockResolvedValue({
      id: 'hook-1',
      enabled: true,
      url: 'https://crm.example.com/lead',
      method: 'POST',
      headersJson: '{}',
      timeoutMs: 5000,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 502, text: async () => 'bad gateway' }))
    );

    const failed = await runCollectionTurn({
      userId: 'u1',
      endpointId: 'ep-1',
      conversationId: 'c-fail',
      message: 'retry',
      state: {
        workflowId: 'wf-1',
        slots: { name: 'Jane Doe', email: 'jane@test.com', phone: '555-111-2222' },
      },
    });
    expect(failed.completed).toBeFalsy();
    expect(failed.reply).toMatch(/could not reach the CRM/i);

    const retryState = await import('./crmWorkflow').then((m) =>
      m.loadWorkflowState('u1', 'c-fail')
    );
    expect(retryState?.slots.email).toBe('jane@test.com');
  });
});
