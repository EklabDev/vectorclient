import { useEffect, useRef, useState } from 'react';
import { ApiClient } from '../../services/api';

// Cloudflare official dummy sitekey (Always passes verification in dev/sandbox)
const CLOUDFLARE_TEST_SITEKEY = '1x00000000000000000000AA';

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
    turnstile?: {
      ready: (fn: () => void) => void;
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (error: unknown) => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

export function TurnstileWidget({ onVerify, onExpire, theme = 'light' }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSiteKey, setActiveSiteKey] = useState<string | null>(null);

  // 1. Resolve Site Key at RUNTIME from backend API, window.__ENV__, or build-time fallback
  useEffect(() => {
    let isMounted = true;

    async function resolveRuntimeKey() {
      // Check window.__ENV__ if injected at container startup
      const windowKey = window.__ENV__?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;
      if (windowKey?.trim()) {
        if (isMounted) setActiveSiteKey(windowKey.trim());
        return;
      }

      // Fetch runtime configuration from backend
      try {
        const config = await ApiClient.getAuthConfig();
        if (isMounted && config.turnstileSiteKey?.trim()) {
          setActiveSiteKey(config.turnstileSiteKey.trim());
          return;
        }
      } catch (err) {
        console.warn('Could not fetch runtime Turnstile config from server:', err);
      }

      // Fallback: build-time Vite env or Cloudflare test key
      const buildKey = (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '').trim();
      if (isMounted) {
        setActiveSiteKey(buildKey || CLOUDFLARE_TEST_SITEKEY);
      }
    }

    resolveRuntimeKey();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Once runtime site key is resolved, render Turnstile widget
  useEffect(() => {
    if (!containerRef.current || !activeSiteKey) return;

    let isMounted = true;

    const render = () => {
      if (!isMounted || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // avoid duplicate widgets

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: activeSiteKey,
          theme,
          callback: (token: string) => {
            if (isMounted) onVerify(token);
          },
          'expired-callback': () => {
            if (isMounted && onExpire) onExpire();
          },
          'error-callback': (err: unknown) => {
            console.warn('Turnstile widget challenge error:', err);
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error('Failed to render Turnstile widget:', err);
      }
    };

    const attachScriptAndRender = () => {
      // If turnstile is already loaded on the page, render immediately
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        render();
        return;
      }

      let script = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.onload = () => {
          if (isMounted) render();
        };
        script.onerror = () => {
          if (isMounted) setLoadError('Unable to load Cloudflare Turnstile script.');
        };
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', () => {
          if (isMounted) render();
        });
      }

      const checkInterval = setInterval(() => {
        if (!isMounted) {
          clearInterval(checkInterval);
          return;
        }
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          clearInterval(checkInterval);
          render();
        }
      }, 50);

      setTimeout(() => clearInterval(checkInterval), 8000);
    };

    attachScriptAndRender();

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [activeSiteKey, theme, onVerify, onExpire]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '8px 0' }}>
      <div
        ref={containerRef}
        style={{
          minHeight: 65,
          minWidth: 300,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
      {loadError && (
        <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
          {loadError}
        </span>
      )}
    </div>
  );
}
