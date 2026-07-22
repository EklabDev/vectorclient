/**
 * Example Shopify App Proxy / Remix action.
 * Wire this to your app's `/apps/vectorclient/invoke` (or configured proxy path).
 *
 * Env:
 *   VECTORCLIENT_BASE_URL
 *   VECTORCLIENT_API_KEY
 *   VECTORCLIENT_ENDPOINT_ID
 *   VECTORCLIENT_USER_ID
 */
import { handleAppProxyInvoke } from '@vectorclient/channel-shopify';

export async function exampleAppProxyInvoke(request: Request): Promise<Response> {
  const config = {
    baseUrl: process.env.VECTORCLIENT_BASE_URL ?? '',
    apiKey: process.env.VECTORCLIENT_API_KEY ?? '',
    endpointId: process.env.VECTORCLIENT_ENDPOINT_ID ?? '',
    userId: process.env.VECTORCLIENT_USER_ID ?? '',
  };

  if (!config.baseUrl || !config.apiKey || !config.endpointId || !config.userId) {
    return Response.json(
      { message: 'VectorClient Shopify env is not configured' },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get('shop') ?? undefined;
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  try {
    const result = await handleAppProxyInvoke(config, payload, { shop });
    return Response.json({ ok: true, data: result.data }, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status) || 500
        : 500;
    return Response.json({ message }, { status });
  }
}
