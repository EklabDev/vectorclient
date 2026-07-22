import {
  createClient,
  type InvokePayload,
  type VectorClientConfig,
} from '@vectorclient/channel-shared';
import type { ShopifyChannelConfig } from './config.js';

/**
 * Build a server-side VectorClient from Shopify app settings / env.
 * Use inside App Proxy, Remix/Oxygen loaders, or Node backends — not in browser theme JS with raw keys.
 */
export function createShopifyServerClient(config: ShopifyChannelConfig) {
  const clientConfig: VectorClientConfig = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    endpointId: config.endpointId,
    userId: config.userId,
    userAgent: config.shopDomain
      ? `VectorClient-Shopify/${config.shopDomain}`
      : 'VectorClient-Shopify',
  };
  return createClient(clientConfig);
}

/**
 * App Proxy handler shape: receive storefront JSON, forward to gateway.
 */
export async function handleAppProxyInvoke(
  config: ShopifyChannelConfig,
  payload: InvokePayload,
  extras?: { shop?: string; customerId?: string }
) {
  const client = createShopifyServerClient({
    ...config,
    shopDomain: extras?.shop ?? config.shopDomain,
  });

  return client.invoke({
    ...payload,
    ...(extras?.shop ? { shop_domain: extras.shop } : {}),
    ...(extras?.customerId ? { customer_id: extras.customerId } : {}),
    channel: 'shopify',
  });
}
