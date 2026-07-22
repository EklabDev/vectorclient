import { buildGatewayUrl, createConfig } from './config.js';
import { messageFromErrorBody, VectorClientError } from './errors.js';
import type {
  InvokeOptions,
  InvokePayload,
  InvokeResult,
  VectorClientConfig,
} from './types.js';

type ResolvedConfig = ReturnType<typeof createConfig>;

/**
 * Thin HTTP client for the VectorClient public gateway.
 * Uses x-api-key auth — not the dashboard JWT ApiClient.
 */
export class VectorClient {
  private readonly config: ResolvedConfig;

  constructor(config: VectorClientConfig) {
    this.config = createConfig(config);
  }

  getConfig(): Readonly<ResolvedConfig> {
    return this.config;
  }

  getGatewayUrl(): string {
    return buildGatewayUrl(this.config.baseUrl, this.config.endpointId, this.config.userId);
  }

  /**
   * POST JSON payload to the configured endpoint.
   * Gateway merges user_id / endpoint_id / schema fields before forwarding.
   */
  async invoke<T = unknown>(
    payload: InvokePayload = {},
    options: InvokeOptions = {}
  ): Promise<InvokeResult<T>> {
    const url = this.getGatewayUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const externalSignal = options.signal;
    const onAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        ...(this.config.userAgent ? { 'User-Agent': this.config.userAgent } : {}),
        ...(this.config.authorization
          ? { Authorization: this.config.authorization }
          : {}),
        ...options.headers,
      };

      // Protect required auth / content-type headers from accidental override
      headers['Content-Type'] = 'application/json';
      headers['x-api-key'] = this.config.apiKey;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      let data: unknown = text;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      } else {
        data = null;
      }

      if (!response.ok) {
        throw new VectorClientError(
          messageFromErrorBody(data, `Request failed with status ${response.status}`),
          response.status,
          data
        );
      }

      return { ok: true, status: response.status, data: data as T };
    } catch (error) {
      if (error instanceof VectorClientError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new VectorClientError('Request timed out or was aborted', 408);
      }
      throw new VectorClientError(
        error instanceof Error ? error.message : 'Unknown network error',
        0
      );
    } finally {
      clearTimeout(timeout);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    }
  }
}

export function createClient(config: VectorClientConfig): VectorClient {
  return new VectorClient(config);
}
