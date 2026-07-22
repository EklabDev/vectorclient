import {
  createElement,
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
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

interface VectorClientContextValue {
  client: VectorClient;
  themeStyle: CSSProperties;
}

const VectorClientContext = createContext<VectorClientContextValue | null>(null);

export interface VectorClientProviderProps {
  config: VectorClientConfig;
  theme?: ChannelThemeInput;
  children: ReactNode;
}

export function VectorClientProvider({
  config,
  theme,
  children,
}: VectorClientProviderProps) {
  const value = useMemo(() => {
    const client = createClient(config);
    const merged = mergeTheme(theme);
    const themeStyle = themeToCssVariables(merged) as CSSProperties;
    return { client, themeStyle };
  }, [config, theme]);

  return createElement(VectorClientContext.Provider, { value }, children);
}

export function useVectorClient(): VectorClient {
  const ctx = useContext(VectorClientContext);
  if (!ctx) {
    throw new Error('useVectorClient must be used within VectorClientProvider');
  }
  return ctx.client;
}

export function useVectorThemeStyle(): CSSProperties {
  const ctx = useContext(VectorClientContext);
  if (!ctx) {
    throw new Error('useVectorThemeStyle must be used within VectorClientProvider');
  }
  return ctx.themeStyle;
}

export interface UseInvokeState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  invoke: (payload?: InvokePayload) => Promise<T | null>;
  reset: () => void;
}

export function useInvoke<T = unknown>(): UseInvokeState<T> {
  const client = useVectorClient();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  const invoke = useCallback(
    async (payload: InvokePayload = {}) => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.invoke<T>(payload);
        setData(result.data);
        return result.data;
      } catch (err) {
        const message =
          err instanceof VectorClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Request failed';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  return { data, error, loading, invoke, reset };
}

export interface VectorPanelProps {
  title?: string;
  placeholder?: string;
  submitLabel?: string;
  onSuccess?: (data: unknown) => void;
}

/** Minimal themed request panel — useful as a starting embed widget. */
export function VectorPanel({
  title = 'VectorClient',
  placeholder = '{"message":"Hello"}',
  submitLabel = 'Send',
  onSuccess,
}: VectorPanelProps) {
  const { invoke, loading, error, data } = useInvoke();
  const themeStyle = useVectorThemeStyle();
  const [raw, setRaw] = useState(placeholder);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    let payload: InvokePayload = {};
    try {
      payload = JSON.parse(raw) as InvokePayload;
    } catch {
      return;
    }
    const result = await invoke(payload);
    if (result != null) onSuccess?.(result);
  };

  return createElement(
    'div',
    {
      className: 'vc-panel',
      style: {
        ...themeStyle,
        background: 'var(--vc-surface)',
        color: 'var(--vc-text)',
        fontFamily: 'var(--vc-font)',
        fontSize: 'var(--vc-font-size)',
        border: '1px solid var(--vc-border)',
        borderRadius: 'var(--vc-radius)',
        boxShadow: 'var(--vc-shadow)',
        padding: 'var(--vc-spacing)',
        display: 'grid',
        gap: 'var(--vc-spacing)',
      } as CSSProperties,
    },
    createElement('h2', { style: { margin: 0, color: 'var(--vc-primary)' } }, title),
    createElement(
      'form',
      { onSubmit, style: { display: 'grid', gap: 'var(--vc-spacing)' } },
      createElement('textarea', {
        value: raw,
        onChange: (e: { target: { value: string } }) => setRaw(e.target.value),
        rows: 6,
        style: {
          width: '100%',
          fontFamily: 'ui-monospace, monospace',
          borderRadius: 'var(--vc-radius)',
          border: '1px solid var(--vc-border)',
          padding: '8px',
        },
      }),
      createElement(
        'button',
        {
          type: 'submit',
          disabled: loading,
          style: {
            background: 'var(--vc-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--vc-radius)',
            padding: '10px 16px',
            cursor: loading ? 'wait' : 'pointer',
          },
        },
        loading ? 'Sending…' : submitLabel
      )
    ),
    error
      ? createElement('p', { role: 'alert', style: { color: '#b91c1c', margin: 0 } }, error)
      : null,
    data != null
      ? createElement(
          'pre',
          {
            style: {
              margin: 0,
              background: 'var(--vc-bg)',
              padding: '8px',
              borderRadius: 'var(--vc-radius)',
              overflow: 'auto',
            },
          },
          JSON.stringify(data, null, 2)
        )
      : null
  );
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
