import type { ChannelTheme, ChannelThemeInput, VectorClientConfig } from './types.js';

const REQUIRED_CONFIG_KEYS: (keyof VectorClientConfig)[] = [
  'baseUrl',
  'apiKey',
  'endpointId',
  'userId',
];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Normalize and validate gateway configuration. */
export function createConfig(input: VectorClientConfig): Required<
  Pick<VectorClientConfig, 'baseUrl' | 'apiKey' | 'endpointId' | 'userId' | 'timeoutMs'>
> &
  Pick<VectorClientConfig, 'userAgent' | 'authorization'> {
  for (const key of REQUIRED_CONFIG_KEYS) {
    const value = input[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ConfigError(`Missing or invalid config.${key}`);
    }
  }

  const baseUrl = input.baseUrl.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new ConfigError('config.baseUrl must start with http:// or https://');
  }

  if (!input.apiKey.startsWith('sk_')) {
    throw new ConfigError('config.apiKey must start with sk_');
  }

  return {
    baseUrl,
    apiKey: input.apiKey.trim(),
    endpointId: input.endpointId.trim(),
    userId: input.userId.trim(),
    timeoutMs: input.timeoutMs ?? 30_000,
    userAgent: input.userAgent,
    authorization: input.authorization,
  };
}

/** Build the public gateway URL for an endpoint/user pair. */
export function buildGatewayUrl(baseUrl: string, endpointId: string, userId: string): string {
  const origin = baseUrl.replace(/\/+$/, '');
  return `${origin}/api/v1/endpoints/${encodeURIComponent(endpointId)}/${encodeURIComponent(userId)}`;
}

/** Default light theme — channels can override via CSS variables or theme props. */
export const DEFAULT_THEME: ChannelTheme = {
  primaryColor: '#0f766e',
  secondaryColor: '#134e4a',
  backgroundColor: '#f8fafc',
  surfaceColor: '#ffffff',
  textColor: '#0f172a',
  mutedTextColor: '#64748b',
  borderColor: '#e2e8f0',
  borderRadius: '8px',
  fontFamily: '"Source Sans 3", "Segoe UI", sans-serif',
  fontSize: '16px',
  spacing: '12px',
  shadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
};

export function mergeTheme(overrides?: ChannelThemeInput): ChannelTheme {
  return { ...DEFAULT_THEME, ...overrides };
}

/** CSS custom properties for embedding channel widgets. */
export function themeToCssVariables(theme: ChannelTheme): Record<string, string> {
  return {
    '--vc-primary': theme.primaryColor,
    '--vc-secondary': theme.secondaryColor,
    '--vc-bg': theme.backgroundColor,
    '--vc-surface': theme.surfaceColor,
    '--vc-text': theme.textColor,
    '--vc-muted': theme.mutedTextColor,
    '--vc-border': theme.borderColor,
    '--vc-radius': theme.borderRadius,
    '--vc-font': theme.fontFamily,
    '--vc-font-size': theme.fontSize,
    '--vc-spacing': theme.spacing,
    '--vc-shadow': theme.shadow,
  };
}

export function themeToInlineStyle(theme: ChannelTheme): string {
  return Object.entries(themeToCssVariables(theme))
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}
