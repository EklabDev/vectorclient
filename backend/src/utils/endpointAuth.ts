import { FastifyRequest } from 'fastify';
import { db } from '../config/database';
import { endpoints, callLogs, endpointApiTokens, apiTokens } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionService } from './encryption';

export type EndpointRow = typeof endpoints.$inferSelect;

export type AuthSuccess = {
  ok: true;
  endpoint: EndpointRow;
  apiTokenId: string | null;
};

export type AuthFailure = {
  ok: false;
  statusCode: number;
  message: string;
  endpoint: EndpointRow | null;
  apiTokenId: string | null;
};

export type AuthResult = AuthSuccess | AuthFailure;

function truncateBody(body: unknown): string | null {
  if (body == null) return null;
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return text.length > 10240 ? text.substring(0, 10240) : text;
}

export async function logEndpointCall(params: {
  endpointId: string;
  apiTokenId: string | null;
  method: string;
  path: string;
  status: number;
  requestBody: unknown;
  responseBody: unknown;
  responseTime: number;
  ipAddress: string | null;
  userAgent: string | null;
  errorMessage: string | null;
}): Promise<void> {
  try {
    await db.insert(callLogs).values({
      id: uuidv4(),
      endpointId: params.endpointId,
      apiTokenId: params.apiTokenId,
      method: params.method,
      path: params.path,
      status: params.status,
      requestBody: truncateBody(params.requestBody),
      responseBody: truncateBody(params.responseBody),
      responseTime: params.responseTime,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      errorMessage: params.errorMessage,
    });
  } catch (logError) {
    console.error('Failed to log call to call_logs:', logError);
  }
}

/**
 * Validate endpoint ownership + optional API token association.
 * Mirrors the auth rules used by the n8n proxy in dynamic.ts.
 */
export async function authenticateEndpointRequest(
  request: FastifyRequest,
  endpointId: string,
  userId: string
): Promise<AuthResult> {
  const [endpoint] = await db
    .select()
    .from(endpoints)
    .where(
      and(eq(endpoints.id, endpointId), eq(endpoints.userId, userId), eq(endpoints.isActive, true))
    )
    .limit(1);

  if (!endpoint) {
    return {
      ok: false,
      statusCode: 404,
      message: 'Endpoint not found or inactive',
      endpoint: null,
      apiTokenId: null,
    };
  }

  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (apiKey) {
    const hashedToken = EncryptionService.hash(apiKey);
    const [token] = await db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.tokenValue, hashedToken), eq(apiTokens.isActive, true)))
      .limit(1);

    if (!token) {
      return {
        ok: false,
        statusCode: 403,
        message: 'Invalid API token',
        endpoint,
        apiTokenId: null,
      };
    }

    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      return {
        ok: false,
        statusCode: 403,
        message: 'API token has expired',
        endpoint,
        apiTokenId: token.id,
      };
    }

    const [association] = await db
      .select()
      .from(endpointApiTokens)
      .where(
        and(
          eq(endpointApiTokens.endpointId, endpointId),
          eq(endpointApiTokens.apiTokenId, token.id)
        )
      )
      .limit(1);

    if (!association) {
      return {
        ok: false,
        statusCode: 403,
        message: 'API token is not authorized for this endpoint',
        endpoint,
        apiTokenId: token.id,
      };
    }

    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, token.id));

    return { ok: true, endpoint, apiTokenId: token.id };
  }

  const associatedTokens = await db
    .select()
    .from(endpointApiTokens)
    .where(eq(endpointApiTokens.endpointId, endpointId))
    .limit(1);

  if (associatedTokens.length > 0) {
    return {
      ok: false,
      statusCode: 403,
      message: 'API token required',
      endpoint,
      apiTokenId: null,
    };
  }

  return { ok: true, endpoint, apiTokenId: null };
}

export function requestMeta(request: FastifyRequest): {
  ipAddress: string | null;
  userAgent: string | null;
  method: string;
  path: string;
} {
  return {
    ipAddress: (request.ip || (request.headers['x-forwarded-for'] as string) || null) as string | null,
    userAgent: (request.headers['user-agent'] as string) || null,
    method: request.method,
    path: request.url.split('?')[0],
  };
}
