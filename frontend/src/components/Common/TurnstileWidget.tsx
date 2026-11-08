import { useEffect, useRef, useState } from 'react';
import { ApiClient } from '../../services/api';

// Cloudflare official dummy sitekey (always passes verification in dev/sandbox)
const CLOUDFLARE_TEST_SITEKEY = '1x00000000000000000000AA';

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
    turnstile?: {
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

  // Synchronously resolve site key from window.__ENV__ (injected from docker-compose .env)
  // or build-time Vite env, or test key
  const [activeSiteKey, setActiveSiteKey] = useState<string>(() => {
    const runtimeKey = window.__ENV__?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim();
    if (runtimeKey) return runtimeKey;
    const buildKey = (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '').trim();
    return buildKey || CLOUDFLARE_TEST_SITEKEY;
  });

  // Optional background sync with backend if no runtime key was injected via Docker
  useEffect(() => {
    if (window.__ENV__?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim()) {
      return; // already have runtime key from docker-compose
    }

    let isMounted = true;
    ApiClient.getAuthConfig()
      .then((config) => {
        if (isMounted && config.turnstileSiteKey?.trim()) {
          setActiveSiteKey(config.turnstileSiteKey.trim());
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Render widget once container and activeSiteKey are ready
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
            console.warn('Turnstile challenge error:', err);
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error('Failed to render Turnstile widget:', err);
        if (isMounted) setLoadError('Failed to initialize verification challenge.');
      }
    };

    if (window.turnstile && typeof window.turnstile.render === 'function') {
      render();
    } else {
      // If script is still loading in <head>, listen for its load event
      const script = document.getElementById('cf-turnstile-script');
      if (script) {
        script.addEventListener('load', render, { once: true });
      }
    }

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
