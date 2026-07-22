import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  VectorClientProvider,
  VectorPanel,
} from '@vectorclient/channel-react';

/**
 * Minimal React example.
 * Replace config values with credentials from your VectorClient dashboard.
 */
const config = {
  baseUrl: import.meta.env.VITE_VC_BASE_URL ?? 'https://your-api-gateway-domain.com',
  apiKey: import.meta.env.VITE_VC_API_KEY ?? 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpointId: import.meta.env.VITE_VC_ENDPOINT_ID ?? '660e8400-e29b-41d4-a716-446655440001',
  userId: import.meta.env.VITE_VC_USER_ID ?? '550e8400-e29b-41d4-a716-446655440000',
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VectorClientProvider
      config={config}
      theme={{ primaryColor: '#0f766e', fontFamily: '"Source Sans 3", sans-serif' }}
    >
      <main style={{ maxWidth: 560, margin: '40px auto', padding: 16 }}>
        <VectorPanel
          title="Ask VectorClient"
          placeholder='{"customer_id":"12345","message":"Need help with my order"}'
          onSuccess={(data) => console.log('gateway response', data)}
        />
      </main>
    </VectorClientProvider>
  </StrictMode>
);
