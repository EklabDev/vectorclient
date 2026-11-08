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
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep callback refs up to date without re-triggering widget mount/unmount
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  const [activeSiteKey, setActiveSiteKey] = useState<string | null>(() => {
    const buildKey = (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '').trim();
    return buildKey || null;
  });

  // Fetch runtime site key from backend /auth/config (reads CLOUDFLARE_TURNSTILE_SITE_KEY from .env)
  useEffect(() => {
    const buildKey = (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '').trim();
    if (buildKey) {
      return;
    }

    let isMounted = true;
    ApiClient.getAuthConfig()
      .then((config) => {
        if (!isMounted) return;
        const runtimeKey = config.turnstileSiteKey?.trim();
        setActiveSiteKey(runtimeKey || CLOUDFLARE_TEST_SITEKEY);
      })
      .catch(() => {
        if (isMounted) {
          setActiveSiteKey(CLOUDFLARE_TEST_SITEKEY);
        }
      });

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
            if (isMounted) onVerifyRef.current(token);
          },
          'expired-callback': () => {
            if (isMounted && onExpireRef.current) onExpireRef.current();
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
  }, [activeSiteKey, theme]);

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
