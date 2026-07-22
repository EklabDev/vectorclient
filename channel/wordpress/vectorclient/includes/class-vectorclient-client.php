<?php
/**
 * Server-side HTTP client for the VectorClient gateway.
 */

if (!defined('ABSPATH')) {
    exit;
}

class VectorClient_Client {
    /** @var VectorClient_Config */
    private $config;

    public function __construct(VectorClient_Config $config) {
        $this->config = $config;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{ok:bool,status:int,data:mixed,message?:string}
     */
    public function invoke(array $payload = array()) {
        if (!$this->config->is_ready()) {
            return array(
                'ok'      => false,
                'status'  => 0,
                'data'    => null,
                'message' => 'VectorClient is not configured. Set base URL, API key, endpoint ID, and user ID.',
            );
        }

        $settings = $this->config->all();
        $timeout  = max(1, (int) ceil(((int) $settings['timeout_ms']) / 1000));

        $response = wp_remote_post(
            $this->config->gateway_url(),
            array(
                'timeout' => $timeout,
                'headers' => array(
                    'Content-Type' => 'application/json',
                    'x-api-key'    => $settings['api_key'],
                ),
                'body'    => wp_json_encode($payload),
            )
        );

        if (is_wp_error($response)) {
            return array(
                'ok'      => false,
                'status'  => 0,
                'data'    => null,
                'message' => $response->get_error_message(),
            );
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);
        $data   = json_decode($body, true);
        if (JSON_ERROR_NONE !== json_last_error()) {
            $data = $body;
        }

        $message = '';
        if (is_array($data) && isset($data['message'])) {
            $message = (string) $data['message'];
        }

        return array(
            'ok'      => $status >= 200 && $status < 300,
            'status'  => $status,
            'data'    => $data,
            'message' => $message,
        );
    }
}
