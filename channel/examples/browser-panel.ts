/**
 * Plain browser example using the shared client (no framework).
 * Prefer a backend proxy when the API key must stay secret.
 */
import { createClient, mergeTheme, themeToInlineStyle } from '@vectorclient/channel-shared';

const config = {
  baseUrl: 'https://your-api-gateway-domain.com',
  apiKey: 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpointId: '660e8400-e29b-41d4-a716-446655440001',
  userId: '550e8400-e29b-41d4-a716-446655440000',
};

const client = createClient(config);
const themeStyle = themeToInlineStyle(mergeTheme({ primaryColor: '#0f766e' }));

export async function sendExample() {
  return client.invoke({
    message: 'Hello from vanilla JS',
    channel: 'browser-example',
  });
}

export function mountPanel(root: HTMLElement) {
  root.setAttribute('style', themeStyle);
  root.innerHTML = `
    <h2 style="color:var(--vc-primary);margin:0">VectorClient</h2>
    <button type="button" data-send>Send example</button>
    <pre data-out></pre>
  `;
  root.querySelector('[data-send]')?.addEventListener('click', async () => {
    const out = root.querySelector('[data-out]');
    try {
      const result = await sendExample();
      if (out) out.textContent = JSON.stringify(result.data, null, 2);
    } catch (err) {
      if (out) out.textContent = err instanceof Error ? err.message : 'Error';
    }
  });
}
