import { FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionService } from './encryption';
import { Endpoints } from '../store/endpoints';
import { Tokens } from '../store/tokens';
import { Logs } from '../store/logs';
import type { EndpointDoc } from '../store/types';

export type EndpointRow = EndpointDoc;

export type AuthSuccess = { ok: true; endpoint: EndpointRow; apiTokenId: string | null };
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
    await Logs.insert({
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
    console.error('Failed to log call:', logError);
  }
}

export async function authenticateEndpointRequest(
  request: FastifyRequest,
  endpointId: string,
  userId: string
): Promise<AuthResult> {
  const endpoint = await Endpoints.findActive(endpointId, userId);
  if (!endpoint) {
    return { ok: false, statusCode: 404, message: 'Endpoint not found or inactive', endpoint: null, apiTokenId: null };
  }

  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const token = await Tokens.findByHash(EncryptionService.hash(apiKey));
    if (!token) {
      return { ok: false, statusCode: 403, message: 'Invalid API token', endpoint, apiTokenId: null };
    }
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      return { ok: false, statusCode: 403, message: 'API token has expired', endpoint, apiTokenId: token.id };
    }
    const linked = await Endpoints.hasTokenLink(endpointId, token.id);
    if (!linked) {
      return {
        ok: false,
        statusCode: 403,
        message: 'API token is not authorized for this endpoint',
        endpoint,
        apiTokenId: token.id,
      };
    }
    await Tokens.touchLastUsed(token.id);
    return { ok: true, endpoint, apiTokenId: token.id };
  }

  const links = await Endpoints.tokenLinks(endpointId);
  if (links.length > 0) {
    return { ok: false, statusCode: 403, message: 'API token required', endpoint, apiTokenId: null };
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

void uuidv4;
