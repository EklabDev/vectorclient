import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../config/database';
import { endpoints } from '../database/schema';
import { eq } from 'drizzle-orm';
import { RedisService } from '../services/redisService';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateLimitBucket>();

/**
 * Rate limit by endpoint config. Uses Redis when REDIS_URL is set;
 * falls back to in-memory token bucket for local/dev without Redis.
 */
export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const params = request.params as { endpoint_id?: string; user_id?: string } | undefined;
    let endpoint =
      params?.endpoint_id && params?.user_id
        ? (
            await db
              .select()
              .from(endpoints)
              .where(eq(endpoints.id, params.endpoint_id))
              .limit(1)
          )[0]
        : undefined;

    if (!endpoint) {
      const route = request.url.split('?')[0];
      const [byRoute] = await db.select().from(endpoints).where(eq(endpoints.route, route)).limit(1);
      endpoint = byRoute;
    }

    if (!endpoint) return;

    const bucketKey = `${request.ip}-${endpoint.id}`;

    if (RedisService.isEnabled()) {
      const allowed = await RedisService.consumeRateLimit(
        bucketKey,
        endpoint.rateLimit,
        endpoint.rateLimitWindowMs
      );
      if (!allowed) {
        reply.code(429).send({ error: 'Rate limit exceeded' });
      }
      return;
    }

    const now = Date.now();
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = { tokens: endpoint.rateLimit, lastRefill: now };
    } else {
      const elapsed = now - bucket.lastRefill;
      const tokensToAdd = (elapsed / endpoint.rateLimitWindowMs) * endpoint.rateLimit;
      bucket.tokens = Math.min(endpoint.rateLimit, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens < 1) {
      reply.code(429).send({ error: 'Rate limit exceeded' });
      return;
    }

    bucket.tokens -= 1;
    buckets.set(bucketKey, bucket);
  } catch (error) {
    console.error('Rate limit check failed:', error);
  }
}

export async function rateLimitPreHandler(request: FastifyRequest, reply: FastifyReply) {
  await rateLimitMiddleware(request, reply);
  if (reply.sent) return;
}
