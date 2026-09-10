import type { AgentToolDefinition } from '../types';
import { RedisService } from '../../redisService';

const DEFAULT_TTL = 300;
const MAX_TTL = 60 * 60 * 24;

export const cacheGetTool: AgentToolDefinition = {
  name: 'cache_get',
  description:
    'Read a short-lived cached value for this client. Key is a relative suffix only (no absolute Redis keys).',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Cache key suffix, e.g. "faq:pricing"',
      },
    },
    required: ['key'],
  },
  async execute(args, ctx) {
    const key = String(args.key ?? '').trim();
    if (!key) throw new Error('key is required');
    if (key.includes(':') && key.startsWith('vc:')) {
      throw new Error('Absolute Redis keys are not allowed');
    }
    const value = await RedisService.get(ctx.userId, `agent:${key}`);
    return { key, value };
  },
};

export const cacheSetTool: AgentToolDefinition = {
  name: 'cache_set',
  description:
    'Store a short-lived cached value for this client. TTL required (seconds). Key is a relative suffix.',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Cache key suffix' },
      value: { type: 'string', description: 'String value to store' },
      ttl_seconds: {
        type: 'number',
        description: `TTL in seconds (1–${MAX_TTL}, default ${DEFAULT_TTL})`,
      },
    },
    required: ['key', 'value'],
  },
  async execute(args, ctx) {
    const key = String(args.key ?? '').trim();
    const value = String(args.value ?? '');
    if (!key) throw new Error('key is required');
    let ttl = typeof args.ttl_seconds === 'number' ? args.ttl_seconds : DEFAULT_TTL;
    ttl = Math.min(MAX_TTL, Math.max(1, Math.floor(ttl)));
    await RedisService.set(ctx.userId, `agent:${key}`, value, ttl);
    return { key, ttl_seconds: ttl, ok: true };
  },
};

export const cacheTools: AgentToolDefinition[] = [cacheGetTool, cacheSetTool];
