export {
  DEFAULT_SHOPIFY_THEME,
  SHOPIFY_SETTING_KEYS,
  mergeShopifyTheme,
  shopifyThemeCssVariables,
  validateStorefrontSettings,
  type ShopifyChannelConfig,
  type ShopifyThemeConfig,
} from './config.js';

export { createShopifyServerClient, handleAppProxyInvoke } from './proxy.js';

export {
  createClient,
  mergeTheme,
  VectorClientError,
  type InvokePayload,
  type VectorClientConfig,
} from '@vectorclient/channel-shared';
