import type { VectorClientErrorBody } from './types.js';

export class VectorClientError extends Error {
  readonly status: number;
  readonly body: VectorClientErrorBody | unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'VectorClientError';
    this.status = status;
    this.body = body ?? { message };
  }
}

export function messageFromErrorBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const msg = (body as VectorClientErrorBody).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}
