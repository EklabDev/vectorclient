import Redis from 'ioredis';
import { createHash } from 'crypto';

const CONV_TTL_SECONDS = 60 * 60 * 24;
const TOOL_CACHE_TTL_SECONDS = 60 * 5;
const MAX_CONV_TURNS = 40;
const MAX_CACHE_VALUE = 64 * 1024;

let client: Redis | null = null;
let unavailable = false;

function getClient(): Redis | null {
  if (unavailable) return null;
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    unavailable = true;
    return null;
  }
  try {
    let hostname: string | null = null;
    let port: string | null = null;
    let hasUsername = false;
    let hasPassword = false;
    try {
      const parsed = new URL(url);
      hostname = parsed.hostname || null;
      port = parsed.port || (parsed.protocol === 'rediss:' ? '6380' : '6379');
      hasUsername = Boolean(parsed.username);
      hasPassword = Boolean(parsed.password);
    } catch {
      /* invalid URL; ioredis will throw below */
    }
    // #region agent log
    fetch('http://127.0.0.1:7552/ingest/c9c6c1fe-9ccc-4c38-a315-a08ca8072384',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd3b7c'},body:JSON.stringify({sessionId:'cd3b7c',runId:'pre-fix',hypothesisId:'H1-H2-H4',location:'redisService.ts:getClient',message:'creating ioredis client',data:{hostname,port,hasUsername,hasPassword,hasRedisPasswordEnv:Boolean(process.env.REDIS_PASSWORD),urlProtocol:url.split(':')[0]},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    client.on('error', (err) => {
      const rec = err as Error & { command?: { name?: string; args?: string[] } };
      // #region agent log
      fetch('http://127.0.0.1:7552/ingest/c9c6c1fe-9ccc-4c38-a315-a08ca8072384',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd3b7c'},body:JSON.stringify({sessionId:'cd3b7c',runId:'pre-fix',hypothesisId:'H1-H3-H5',location:'redisService.ts:error',message:'redis client error',data:{errName:err.name,errMessage:err.message.slice(0,180),commandName:rec.command?.name??null,commandArgCount:rec.command?.args?.length??null,firstArg:rec.command?.args?.[0]??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      console.error('Redis error:', err.message);
    });
    client.on('ready', () => {
      // #region agent log
      fetch('http://127.0.0.1:7552/ingest/c9c6c1fe-9ccc-4c38-a315-a08ca8072384',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cd3b7c'},body:JSON.stringify({sessionId:'cd3b7c',runId:'post-fix',hypothesisId:'H4',location:'redisService.ts:ready',message:'redis client ready',data:{hostname,port,hasPassword},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    });
    return client;
  } catch (err) {
    console.error('Redis init failed:', err);
    unavailable = true;
    return null;
  }
}

function userPrefix(userId: string): string {
  return `vc:${userId}:`;
}

export class RedisService {
  static isEnabled(): boolean {
    return !!getClient();
  }

  static key(userId: string, suffix: string): string {
    const clean = suffix.replace(/^\/+/, '').replace(/\.\./g, '');
    return `${userPrefix(userId)}${clean}`;
  }

  static async get(userId: string, suffix: string): Promise<string | null> {
    const redis = getClient();
    if (!redis) return null;
    return redis.get(this.key(userId, suffix));
  }

  static async set(
    userId: string,
    suffix: string,
    value: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const redis = getClient();
    if (!redis) return false;
    if (value.length > MAX_CACHE_VALUE) {
      throw new Error(`Value exceeds max size of ${MAX_CACHE_VALUE} bytes`);
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) {
      throw new Error('ttlSeconds must be a positive number');
    }
    await redis.set(this.key(userId, suffix), value, 'EX', Math.floor(ttlSeconds));
    return true;
  }

  static async del(userId: string, suffix: string): Promise<void> {
    const redis = getClient();
    if (!redis) return;
    await redis.del(this.key(userId, suffix));
  }

  static async getConversation(
    userId: string,
    conversationId: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const raw = await this.get(userId, `conv:${conversationId}`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Array<{ role: 'user' | 'assistant'; content: string }>;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static async appendConversationTurn(
    userId: string,
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const turns = await this.getConversation(userId, conversationId);
    turns.push({ role, content });
    const trimmed = turns.slice(-MAX_CONV_TURNS);
    await this.set(userId, `conv:${conversationId}`, JSON.stringify(trimmed), CONV_TTL_SECONDS);
  }

  static toolCacheKey(tool: string, args: Record<string, unknown>): string {
    const hash = createHash('sha256')
      .update(JSON.stringify({ tool, args }))
      .digest('hex')
      .slice(0, 32);
    return `toolcache:${tool}:${hash}`;
  }

  static async getToolCache(
    userId: string,
    tool: string,
    args: Record<string, unknown>
  ): Promise<unknown | null> {
    const raw = await this.get(userId, this.toolCacheKey(tool, args));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static async setToolCache(
    userId: string,
    tool: string,
    args: Record<string, unknown>,
    value: unknown,
    ttlSeconds: number = TOOL_CACHE_TTL_SECONDS
  ): Promise<void> {
    await this.set(userId, this.toolCacheKey(tool, args), JSON.stringify(value), ttlSeconds);
  }

  /** Token-bucket style rate limit. Returns true if allowed. */
  static async consumeRateLimit(
    bucketKey: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    const redis = getClient();
    if (!redis) return true; // fail open if redis down
    const key = `ratelimit:${bucketKey}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    return count <= limit;
  }

  static getRawClient(): Redis | null {
    return getClient();
  }
}
