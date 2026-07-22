<?php
/**
 * Lightweight unit tests for VectorClient WordPress helpers.
 * Run: php channel/wordpress/tests/run-tests.php
 *
 * WordPress functions are stubbed so tests run without a full WP install.
 */

declare(strict_types=1);

$failures = 0;

function assert_true(bool $cond, string $message): void {
    global $failures;
    if (!$cond) {
        echo "FAIL: {$message}\n";
        $failures++;
    } else {
        echo "PASS: {$message}\n";
    }
}

// --- WordPress stubs -------------------------------------------------------
$GLOBALS['vc_options'] = array();

function get_option($key, $default = false) {
    return array_key_exists($key, $GLOBALS['vc_options']) ? $GLOBALS['vc_options'][$key] : $default;
}

function update_option($key, $value) {
    $GLOBALS['vc_options'][$key] = $value;
    return true;
}

function add_option($key, $value) {
    if (!array_key_exists($key, $GLOBALS['vc_options'])) {
        $GLOBALS['vc_options'][$key] = $value;
    }
    return true;
}

function esc_url_raw($url) {
    return filter_var($url, FILTER_SANITIZE_URL) ?: $url;
}

function untrailingslashit($value) {
    return rtrim((string) $value, '/');
}

function trailingslashit($value) {
    return rtrim((string) $value, '/') . '/';
}

function sanitize_text_field($value) {
    return trim(strip_tags((string) $value));
}

function absint($value) {
    return abs((int) $value);
}

function wp_json_encode($data) {
    return json_encode($data);
}

$GLOBALS['vc_last_request'] = null;
$GLOBALS['vc_mock_response'] = null;

function wp_remote_post($url, $args = array()) {
    $GLOBALS['vc_last_request'] = array('url' => $url, 'args' => $args);
    return $GLOBALS['vc_mock_response'];
}

function is_wp_error($thing) {
    return is_array($thing) && !empty($thing['is_error']);
}

function wp_remote_retrieve_response_code($response) {
    return $response['code'] ?? 0;
}

function wp_remote_retrieve_body($response) {
    return $response['body'] ?? '';
}

define('ABSPATH', __DIR__);

require_once dirname(__DIR__) . '/vectorclient/includes/class-vectorclient-config.php';
require_once dirname(__DIR__) . '/vectorclient/includes/class-vectorclient-client.php';
require_once dirname(__DIR__) . '/vectorclient/includes/class-vectorclient-theme.php';

// --- Tests -----------------------------------------------------------------
$config = new VectorClient_Config();
assert_true(!$config->is_ready(), 'config is not ready with empty defaults');

$saved = $config->save(array(
    'base_url'    => 'https://gw.example.com/',
    'api_key'     => 'sk_test_abc',
    'endpoint_id' => 'ep-1',
    'user_id'     => 'user-1',
    'timeout_ms'  => 15000,
    'theme'       => array('primary_color' => '#112233'),
));

assert_true($saved['base_url'] === 'https://gw.example.com', 'base_url is normalized');
assert_true($config->is_ready(), 'config is ready after save');
assert_true(
    $config->gateway_url() === 'https://gw.example.com/api/v1/endpoints/ep-1/user-1',
    'gateway URL matches public route'
);

$theme = new VectorClient_Theme($config);
$vars = $theme->css_variables();
assert_true($vars['--vc-primary'] === '#112233', 'theme primary color override applied');
assert_true(strpos($theme->inline_style(), '--vc-primary:#112233') !== false, 'inline style includes primary');

$GLOBALS['vc_mock_response'] = array(
    'code' => 200,
    'body' => json_encode(array('result' => 'ok')),
);

$client = new VectorClient_Client($config);
$result = $client->invoke(array('customer_id' => '123'));
assert_true($result['ok'] === true, 'client invoke succeeds');
assert_true($result['data']['result'] === 'ok', 'client parses JSON body');
assert_true(
    $GLOBALS['vc_last_request']['args']['headers']['x-api-key'] === 'sk_test_abc',
    'client sends x-api-key header'
);
assert_true(
    $GLOBALS['vc_last_request']['args']['headers']['Content-Type'] === 'application/json',
    'client sends JSON content type'
);

$GLOBALS['vc_mock_response'] = array(
    'code' => 403,
    'body' => json_encode(array('message' => 'Invalid API token')),
);
$fail = $client->invoke(array());
assert_true($fail['ok'] === false && $fail['status'] === 403, 'client surfaces 403');
assert_true($fail['message'] === 'Invalid API token', 'client surfaces gateway message');

if ($failures > 0) {
    echo "\n{$failures} failure(s)\n";
    exit(1);
}

echo "\nAll WordPress channel tests passed.\n";
exit(0);
