import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShopifyServerClient,
  handleAppProxyInvoke,
  mergeShopifyTheme,
  validateStorefrontSettings,
} from './index.js';

describe('validateStorefrontSettings', () => {
  it('requires endpoint and user', () => {
    const errors = validateStorefrontSettings({ proxyPath: '/apps/vectorclient' });
    expect(errors).toContain('endpointId is required');
    expect(errors).toContain('userId is required');
  });

  it('accepts proxy-based setup', () => {
    expect(
      validateStorefrontSettings({
        proxyPath: '/apps/vectorclient',
        endpointId: 'ep',
        userId: 'u',
      })
    ).toEqual([]);
  });
});

describe('mergeShopifyTheme', () => {
  it('overrides primary color', () => {
    expect(mergeShopifyTheme({ primaryColor: '#abc' }).primaryColor).toBe('#abc');
  });
});

describe('Shopify server client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('invoke includes shopify channel metadata via proxy helper', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await handleAppProxyInvoke(
      {
        baseUrl: 'https://gw.test',
        apiKey: 'sk_shop_key',
        endpointId: 'ep-1',
        userId: 'user-1',
      },
      { message: 'hi' },
      { shop: 'acme.myshopify.com', customerId: 'gid://shopify/Customer/1' }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.channel).toBe('shopify');
    expect(body.shop_domain).toBe('acme.myshopify.com');
    expect(body.customer_id).toBe('gid://shopify/Customer/1');
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('sk_shop_key');
  });

  it('createShopifyServerClient builds gateway URL', () => {
    const client = createShopifyServerClient({
      baseUrl: 'https://gw.test',
      apiKey: 'sk_shop_key',
      endpointId: 'ep-1',
      userId: 'user-1',
      shopDomain: 'acme.myshopify.com',
    });
    expect(client.getGatewayUrl()).toContain('/api/v1/endpoints/ep-1/user-1');
  });
});
