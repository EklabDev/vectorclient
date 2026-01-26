import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../config/database';
import { endpoints } from '../database/schema';
import { eq } from 'drizzle-orm';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateLimitBucket>();

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get endpoint config
    const route = request.url.split('?')[0];
    // This assumes the route in DB matches the request URL path exactly for now.
    // In a real router, we might need to match patterns, but for this guide it implies direct match or we need to lookup properly.
    // For dynamic routes like /api/v1/endpoints/:user/:route, we might need more logic.
    // But let's follow the guide's logic for now.

    const [endpoint] = await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.route, route))
      .limit(1);

    if (!endpoint) {
      return; // Not a managed endpoint, or let the router handle 404/others
    }

    const bucketKey = `${request.ip}-${endpoint.id}`;
    const now = Date.now();

    let bucket = buckets.get(bucketKey);

    if (!bucket) {
      bucket = {
        tokens: endpoint.rateLimit,
        lastRefill: now,
      };
    } else {
      // Refill tokens based on elapsed time
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
    // Log but don't fail the request
    console.error('Rate limit check failed:', error);
  }
}
