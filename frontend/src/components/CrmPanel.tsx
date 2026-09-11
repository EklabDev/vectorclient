import { useEffect, useState, type CSSProperties } from 'react';
import { ApiClient } from '../services/api';

type Webhook = { id: string; name: string; url: string; enabled: boolean };
type Field = { name: string; type: 'string' | 'number' | 'email'; required: boolean; prompt: string };
type Workflow = { id: string; name: string };

const DEFAULT_FIELDS: Field[] = [
  { name: 'name', type: 'string', required: true, prompt: 'What is your name?' },
  { name: 'email', type: 'email', required: true, prompt: 'What is your email?' },
  { name: 'phone', type: 'string', required: true, prompt: 'What is your phone number?' },
];

function toJsonSchema(fields: Field[]) {
  const properties: Record<string, { type: string; format?: string }> = {};
  for (const f of fields) {
    properties[f.name] = f.type === 'email' ? { type: 'string', format: 'email' } : { type: f.type };
  }
  return { type: 'object', required: fields.filter((f) => f.required).map((f) => f.name), properties };
}

export function CrmPanel({ endpointId, onClose }: { endpointId: string; onClose: () => void }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState('');
  const [hookForm, setHookForm] = useState({ name: 'CRM', url: '', headers: '' });
  const [wfForm, setWfForm] = useState({ name: 'Lead capture', phrases: 'sign up, enroll', webhookId: '' });

  const reload = async () => {
    const [hooks, wfs, schema] = await Promise.all([
      ApiClient.getCrmWebhooks(endpointId) as Promise<Webhook[]>,
      ApiClient.getCrmWorkflows(endpointId) as Promise<Workflow[]>,
      ApiClient.getCrmSchema(endpointId),
    ]);
    setWebhooks(Array.isArray(hooks) ? hooks : []);
    setWorkflows(Array.isArray(wfs) ? wfs : []);
    const props = (schema?.jsonSchema?.properties || {}) as Record<string, { type?: string; format?: string }>;
    const required = new Set((schema?.jsonSchema?.required as string[]) || []);
    const loaded = Object.entries(props).map(([name, spec]) => ({
      name,
      type: (spec.format === 'email' ? 'email' : spec.type === 'number' ? 'number' : 'string') as Field['type'],
      required: required.has(name),
      prompt: `What is your ${name}?`,
    }));
    if (loaded.length) setFields(loaded);
  };

  useEffect(() => {
    reload().catch((e) => setError((e as Error).message));
  }, [endpointId]);

  const updateField = (i: number, patch: Partial<Field>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>CRM webhooks & collection</h2>
          <button onClick={onClose} style={btnGhost}>Close</button>
        </div>
        {error && <div style={{ color: '#fca5a5' }}>{error}</div>}

        <h3>Webhooks</h3>
        {webhooks.map((w) => (
          <div key={w.id} style={row}>
            <span>{w.name} — {w.url}</span>
            <span>
              <button
                onClick={async () => {
                  const sample = Object.fromEntries(fields.map((f) => [f.name, f.type === 'email' ? 'test@example.com' : 'sample']));
                  const res = await ApiClient.testCrmWebhook(endpointId, w.id, sample) as { ok?: boolean; status?: number };
                  setTestResult(`Test send → ${res.ok ? 'ok' : 'failed'} (${res.status ?? '?'})`);
                }}
                style={btnGhost}
              >
                Test send
              </button>
              <button onClick={() => ApiClient.deleteCrmWebhook(endpointId, w.id).then(reload)} style={btnGhost}>Delete</button>
            </span>
          </div>
        ))}
        <input placeholder="Name" value={hookForm.name} onChange={(e) => setHookForm({ ...hookForm, name: e.target.value })} />
        <input placeholder="https://crm.example.com/lead" value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
        <input placeholder='Headers JSON e.g. {"Authorization":"Bearer …"}' value={hookForm.headers} onChange={(e) => setHookForm({ ...hookForm, headers: e.target.value })} style={{ width: '100%' }} />
        <button
          style={btn}
          onClick={async () => {
            const headers = hookForm.headers ? JSON.parse(hookForm.headers) : {};
            await ApiClient.createCrmWebhook(endpointId, { name: hookForm.name, url: hookForm.url, headers });
            await reload();
          }}
        >
          Add webhook
        </button>
        {testResult && <p style={{ color: '#86efac' }}>{testResult}</p>}

        <h3>Fields to collect</h3>
        {fields.map((f, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 1fr auto', gap: 6, marginBottom: 6 }}>
            <input value={f.name} onChange={(e) => updateField(i, { name: e.target.value })} placeholder="name" />
            <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as Field['type'] })}>
              <option value="string">string</option>
              <option value="email">email</option>
              <option value="number">number</option>
            </select>
            <label style={{ fontSize: 12, color: '#9aa3b5' }}>
              <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> req
            </label>
            <input value={f.prompt} onChange={(e) => updateField(i, { prompt: e.target.value })} placeholder="Question to ask" />
            <button style={btnGhost} onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
          </div>
        ))}
        <button style={btnGhost} onClick={() => setFields((prev) => [...prev, { name: '', type: 'string', required: true, prompt: '' }])}>
          Add field
        </button>
        <button
          style={{ ...btn, marginLeft: 8 }}
          onClick={async () => {
            await ApiClient.putCrmSchema(endpointId, toJsonSchema(fields));
            await reload();
          }}
        >
          Save schema
        </button>

        <h3>Collection workflow</h3>
        {workflows.map((w) => (
          <div key={w.id} style={row}>
            <span>{w.name}</span>
            <button onClick={() => ApiClient.deleteCrmWorkflow(endpointId, w.id).then(reload)} style={btnGhost}>Delete</button>
          </div>
        ))}
        <input placeholder="Workflow name" value={wfForm.name} onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })} />
        <input placeholder="Trigger phrases" value={wfForm.phrases} onChange={(e) => setWfForm({ ...wfForm, phrases: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
        <select value={wfForm.webhookId} onChange={(e) => setWfForm({ ...wfForm, webhookId: e.target.value })}>
          <option value="">No webhook</option>
          {webhooks.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <button
          style={{ ...btn, marginLeft: 8 }}
          onClick={async () => {
            await ApiClient.createCrmWorkflow(endpointId, {
              name: wfForm.name,
              webhookId: wfForm.webhookId || null,
              trigger: { keywords: [], phrases: wfForm.phrases.split(',').map((s) => s.trim()).filter(Boolean) },
              steps: fields.filter((f) => f.name).map((f) => ({ field: f.name, prompt: f.prompt || `What is your ${f.name}?`, required: f.required })),
              confirmMessage: 'Thanks — we received your details.',
            });
            await reload();
          }}
        >
          Save workflow
        </button>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};
const modal: CSSProperties = {
  background: '#1a1c22',
  border: '1px solid #2a2e38',
  borderRadius: 10,
  padding: 24,
  width: 720,
  maxHeight: '90vh',
  overflow: 'auto',
};
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', gap: 8 };
const btn: CSSProperties = {
  padding: '6px 12px',
  backgroundColor: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  marginTop: 8,
};
const btnGhost: CSSProperties = { ...btn, backgroundColor: '#2a2e38' };
