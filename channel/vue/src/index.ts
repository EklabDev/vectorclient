import { computed, inject, provide, ref, type App, type InjectionKey, type Ref } from 'vue';
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

export interface VectorClientPluginOptions {
  config: VectorClientConfig;
  theme?: ChannelThemeInput;
}

interface VectorClientContext {
  client: VectorClient;
  themeVars: Record<string, string>;
}

const VECTOR_CLIENT_KEY: InjectionKey<VectorClientContext> = Symbol('vectorclient');

export function createVectorClient(options: VectorClientPluginOptions) {
  const client = createClient(options.config);
  const themeVars = themeToCssVariables(mergeTheme(options.theme));
  const context: VectorClientContext = { client, themeVars };

  return {
    install(app: App) {
      app.provide(VECTOR_CLIENT_KEY, context);
    },
    client,
    themeVars,
  };
}

export function provideVectorClient(options: VectorClientPluginOptions): VectorClientContext {
  const client = createClient(options.config);
  const themeVars = themeToCssVariables(mergeTheme(options.theme));
  const context = { client, themeVars };
  provide(VECTOR_CLIENT_KEY, context);
  return context;
}

function requireContext(): VectorClientContext {
  const ctx = inject(VECTOR_CLIENT_KEY);
  if (!ctx) {
    throw new Error('VectorClient is not provided. Call app.use(createVectorClient(...)) first.');
  }
  return ctx;
}

export function useVectorClient(): VectorClient {
  return requireContext().client;
}

export function useVectorThemeVars(): Record<string, string> {
  return requireContext().themeVars;
}

export function useInvoke<T = unknown>() {
  const client = useVectorClient();
  const data: Ref<T | null> = ref(null);
  const error: Ref<string | null> = ref(null);
  const loading = ref(false);

  async function invoke(payload: InvokePayload = {}): Promise<T | null> {
    loading.value = true;
    error.value = null;
    try {
      const result = await client.invoke<T>(payload);
      data.value = result.data;
      return result.data;
    } catch (err) {
      error.value =
        err instanceof VectorClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Request failed';
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    data.value = null;
    error.value = null;
    loading.value = false;
  }

  return {
    data,
    error,
    loading,
    invoke,
    reset,
    panelStyle: computed(() => ({
      ...requireContext().themeVars,
      background: 'var(--vc-surface)',
      color: 'var(--vc-text)',
      fontFamily: 'var(--vc-font)',
      border: '1px solid var(--vc-border)',
      borderRadius: 'var(--vc-radius)',
      boxShadow: 'var(--vc-shadow)',
      padding: 'var(--vc-spacing)',
    })),
  };
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
