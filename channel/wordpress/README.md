# VectorClient WordPress Channel

Native WordPress plugin that stores gateway credentials + theme settings and exposes a shortcode. API keys never ship to the browser — the shortcode posts to a WordPress REST proxy which calls the VectorClient gateway server-side.

## Install

1. Copy `channel/wordpress/vectorclient` into `wp-content/plugins/vectorclient`
2. Activate **VectorClient Channel** in WP Admin → Plugins
3. Open **Settings → VectorClient**
4. Fill in:
   - Base URL
   - API key (`sk_…`)
   - Endpoint ID
   - User ID
5. Optionally customize theme colors / font / radius
6. Save

## Shortcode

```
[vectorclient title="Ask us" placeholder='{"message":"Hello"}' submit="Send"]
```

## Programmatic usage (PHP)

```php
$config = new VectorClient_Config();
$client = new VectorClient_Client($config);
$result = $client->invoke([
    'customer_id' => '12345',
    'order_amount' => 99.99,
]);
```

## REST proxy

`POST /wp-json/vectorclient/v1/invoke` with a JSON body. The plugin adds `x-api-key` when forwarding to:

`POST {baseUrl}/api/v1/endpoints/{endpointId}/{userId}`

## Tests

```bash
php channel/wordpress/tests/run-tests.php
```

## Security notes

- Keep the API key only in **Settings → VectorClient** (server-side option).
- Prefer restricting the REST route with auth / nonce checks for logged-in or capability-gated use in production if the widget should not be public.
