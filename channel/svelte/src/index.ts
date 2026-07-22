import { getContext, setContext } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import {
  createClient,
  mergeTheme,
  themeToCssVariables,
  VectorClient,
  VectorClientError,
  type ChannelThemeInput,
  type InvokePayload,
  type VectorClientConfig,
} from '@vectorclient/channel-shared';

const CONTEXT_KEY = 'vectorclient';

export interface VectorClientContext {
  client: VectorClient;
  themeVars: Record<string, string>;
}

export function setVectorClient(
  config: VectorClientConfig,
  theme?: ChannelThemeInput
): VectorClientContext {
  const client = createClient(config);
  const themeVars = themeToCssVariables(mergeTheme(theme));
  const ctx: VectorClientContext = { client, themeVars };
  setContext(CONTEXT_KEY, ctx);
  return ctx;
}

export function getVectorClient(): VectorClient {
  const ctx = getContext<VectorClientContext | undefined>(CONTEXT_KEY);
  if (!ctx) {
    throw new Error('VectorClient context missing. Call setVectorClient() in a parent component.');
  }
  return ctx.client;
}

export function getVectorThemeVars(): Record<string, string> {
  const ctx = getContext<VectorClientContext | undefined>(CONTEXT_KEY);
  if (!ctx) {
    throw new Error('VectorClient context missing. Call setVectorClient() in a parent component.');
  }
  return ctx.themeVars;
}

export interface InvokeStore<T = unknown> {
  data: Writable<T | null>;
  error: Writable<string | null>;
  loading: Writable<boolean>;
  invoke: (payload?: InvokePayload) => Promise<T | null>;
  reset: () => void;
}

export function createInvokeStore<T = unknown>(client: VectorClient): InvokeStore<T> {
  const data = writable<T | null>(null);
  const error = writable<string | null>(null);
  const loading = writable(false);

  async function invoke(payload: InvokePayload = {}): Promise<T | null> {
    loading.set(true);
    error.set(null);
    try {
      const result = await client.invoke<T>(payload);
      data.set(result.data);
      return result.data;
    } catch (err) {
      error.set(
        err instanceof VectorClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Request failed'
      );
      return null;
    } finally {
      loading.set(false);
    }
  }

  function reset() {
    data.set(null);
    error.set(null);
    loading.set(false);
  }

  return { data, error, loading, invoke, reset };
}

export {
  createClient,
  mergeTheme,
  DEFAULT_THEME,
  VectorClientError,
  type VectorClientConfig,
  type ChannelThemeInput,
  type InvokePayload,
} from '@vectorclient/channel-shared';
