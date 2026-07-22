/**
 * Framework-agnostic node example.
 * Run after: cd channel/shared && npm install && npm run build
 *
 *   node --experimental-strip-types channel/examples/node-invoke.mjs
 * or compile shared and import from dist.
 */
import { createClient } from '../shared/src/index.ts';

const client = createClient({
  baseUrl: process.env.VECTORCLIENT_BASE_URL ?? 'https://your-api-gateway-domain.com',
  apiKey: process.env.VECTORCLIENT_API_KEY ?? 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpointId: process.env.VECTORCLIENT_ENDPOINT_ID ?? '660e8400-e29b-41d4-a716-446655440001',
  userId: process.env.VECTORCLIENT_USER_ID ?? '550e8400-e29b-41d4-a716-446655440000',
});

const result = await client.invoke({
  customer_id: '12345',
  order_amount: 99.99,
  payment_method: 'credit_card',
  channel: 'node-example',
});

console.log(result);
