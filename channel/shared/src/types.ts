/**
 * Configuration required to call the VectorClient public gateway.
 * Matches POST /api/v1/endpoints/:endpoint_id/:user_id with x-api-key.
 */
export interface VectorClientConfig {
  /** Gateway origin, e.g. https://your-api-gateway-domain.com */
  baseUrl: string;
  /** API token: sk_<prefix>_<secret> */
  apiKey: string;
  /** Endpoint UUID from the dashboard */
  endpointId: string;
  /** Account owner / endpoint owner UUID */
  userId: string;
  /** Optional timeout in milliseconds (default 30000) */
  timeoutMs?: number;
  /** Optional User-Agent forwarded by the gateway */
  userAgent?: string;
  /** Optional Authorization header forwarded to the target webhook */
  authorization?: string;
}

/** Theme tokens for channel UI widgets (chat, forms, panels). */
export interface ChannelTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  spacing: string;
  shadow: string;
}

export type ChannelThemeInput = Partial<ChannelTheme>;

/** Arbitrary JSON payload sent to the gateway (multipart is not supported). */
export type InvokePayload = Record<string, unknown>;

export interface InvokeOptions {
  /** Extra headers merged into the request (cannot override Content-Type / x-api-key) */
  headers?: Record<string, string>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface InvokeResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export interface VectorClientErrorBody {
  message: string;
}
