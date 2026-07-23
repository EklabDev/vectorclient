/**
 * Shopify channel configuration.
 * Prefer App Proxy / server-side metafields for apiKey — never put sk_ tokens in theme Liquid.
 */
export interface ShopifyChannelConfig {
  /** Gateway origin */
  baseUrl: string;
  /** API token — use only in app backend / app proxy */
  apiKey: string;
  endpointId: string;
  userId: string;
  /** Optional Shopify shop domain for logging/context */
  shopDomain?: string;
  /** Theme tokens for Liquid CSS variables */
  theme?: Partial<ShopifyThemeConfig>;
}

export interface ShopifyThemeConfig {
  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  borderRadius: string;
  fontFamily: string;
}

export const DEFAULT_SHOPIFY_THEME: ShopifyThemeConfig = {
  primaryColor: '#0f766e',
  surfaceColor: '#ffffff',
  textColor: '#0f172a',
  borderRadius: '8px',
  fontFamily: '"Source Sans 3", "Helvetica Neue", sans-serif',
};

/** Metafield / settings schema keys used by the theme app extension. */
export const SHOPIFY_SETTING_KEYS = {
  baseUrl: 'vectorclient_base_url',
  endpointId: 'vectorclient_endpoint_id',
  userId: 'vectorclient_user_id',
  /** App proxy path that injects the API key server-side */
  proxyPath: 'vectorclient_proxy_path',
  primaryColor: 'vectorclient_primary_color',
  surfaceColor: 'vectorclient_surface_color',
  textColor: 'vectorclient_text_color',
  borderRadius: 'vectorclient_border_radius',
  fontFamily: 'vectorclient_font_family',
} as const;

export function mergeShopifyTheme(
  overrides?: Partial<ShopifyThemeConfig>
): ShopifyThemeConfig {
  return { ...DEFAULT_SHOPIFY_THEME, ...overrides };
}

export function shopifyThemeCssVariables(
  theme: ShopifyThemeConfig
): Record<string, string> {
  return {
    '--vc-primary': theme.primaryColor,
    '--vc-surface': theme.surfaceColor,
    '--vc-text': theme.textColor,
    '--vc-radius': theme.borderRadius,
    '--vc-font': theme.fontFamily,
  };
}

/**
 * Validate merchant-facing settings (no API key — that lives in the app backend).
 */
export function validateStorefrontSettings(input: {
  baseUrl?: string;
  endpointId?: string;
  userId?: string;
  proxyPath?: string;
}): string[] {
  const errors: string[] = [];
  if (!input.proxyPath && !input.baseUrl) {
    errors.push('Provide either proxyPath (recommended) or baseUrl');
  }
  if (input.baseUrl && !/^https?:\/\//i.test(input.baseUrl)) {
    errors.push('baseUrl must start with http:// or https://');
  }
  if (!input.endpointId) errors.push('endpointId is required');
  if (!input.userId) errors.push('userId is required');
  return errors;
}
