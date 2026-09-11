import { AsyncLocalStorage } from 'node:async_hooks';
import { arcadePassword, arcadeUrl, arcadeUser } from './config';

const sessionAls = new AsyncLocalStorage<string>();

export type ArcadeFetch = (input: string, init?: RequestInit) => Promise<Response>;

let fetchImpl: ArcadeFetch = (input, init) => globalThis.fetch(input, init);

export function setArcadeFetch(fn: ArcadeFetch): void {
  fetchImpl = fn;
}

export function resetArcadeFetch(): void {
  fetchImpl = (input, init) => globalThis.fetch(input, init);
}

export class ArcadeError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ArcadeError';
    this.status = status;
    this.body = body;
  }
}

function authHeader(): string {
  const token = Buffer.from(`${arcadeUser()}:${arcadePassword()}`).toString('base64');
  return `Basic ${token}`;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    if (typeof rec.detail === 'string') return rec.detail;
    if (typeof rec.error === 'string') return rec.error;
    if (typeof rec.message === 'string') return rec.message;
  }
  if (typeof body === 'string' && body.trim()) return body;
  return fallback;
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const url = `${arcadeUrl()}${path}`;
  const session = sessionAls.getStore();
  const res = await fetchImpl(url, {
    ...init,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(session ? { 'arcadedb-session-id': session } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await parseBody(res);
  if (!res.ok) {
    throw new ArcadeError(errorMessage(body, `ArcadeDB ${res.status}`), res.status, body);
  }
  return body;
}

function resultRows(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return [];
  const rec = body as Record<string, unknown>;
  if (Array.isArray(rec.result)) return rec.result as Record<string, unknown>[];
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  return [];
}

export async function arcadeReady(): Promise<boolean> {
  try {
    const res = await fetchImpl(`${arcadeUrl()}/api/v1/ready`, {
      headers: { Authorization: authHeader() },
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function serverCommand(command: string): Promise<unknown> {
  return request('/api/v1/server', {
    method: 'POST',
    body: JSON.stringify({ command }),
  });
}

export async function query<T = Record<string, unknown>>(
  database: string,
  command: string,
  params: Record<string, unknown> = {},
  language = 'sql'
): Promise<T[]> {
  const body = await request(`/api/v1/query/${encodeURIComponent(database)}`, {
    method: 'POST',
    body: JSON.stringify({ language, command, params }),
  });
  return resultRows(body) as T[];
}

export async function command<T = Record<string, unknown>>(
  database: string,
  commandText: string,
  params: Record<string, unknown> = {},
  language = 'sql'
): Promise<T[]> {
  const body = await request(`/api/v1/command/${encodeURIComponent(database)}`, {
    method: 'POST',
    body: JSON.stringify({ language, command: commandText, params }),
  });
  return resultRows(body) as T[];
}

export async function withTransaction<T>(database: string, fn: () => Promise<T>): Promise<T> {
  const sessionId = await beginTransaction(database);
  if (!sessionId) return fn();
  try {
    return await sessionAls.run(sessionId, async () => {
      const result = await fn();
      await request(`/api/v1/commit/${encodeURIComponent(database)}`, { method: 'POST' });
      return result;
    });
  } catch (err) {
    try {
      await sessionAls.run(sessionId, () =>
        request(`/api/v1/rollback/${encodeURIComponent(database)}`, { method: 'POST' })
      );
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  }
}

async function beginTransaction(database: string): Promise<string | null> {
  const url = `${arcadeUrl()}/api/v1/begin/${encodeURIComponent(database)}`;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: authHeader() },
    });
    await parseBody(res);
    if (!res.ok) return null;
    return res.headers.get('arcadedb-session-id') || res.headers.get('ArcadeDB-Session-Id');
  } catch {
    return null;
  }
}

export async function listDatabases(): Promise<string[]> {
  const body = await serverCommand('list databases');
  if (Array.isArray(body)) return body.map(String);
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.result)) return rec.result.map(String);
    if (Array.isArray(rec.databases)) return rec.databases.map(String);
  }
  return [];
}
