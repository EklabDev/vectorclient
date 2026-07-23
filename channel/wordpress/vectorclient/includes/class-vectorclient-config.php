<?php
/**
 * Stores gateway + theme settings in wp_options.
 */

if (!defined('ABSPATH')) {
    exit;
}

class VectorClient_Config {
    const OPTION_KEY = 'vectorclient_settings';

    /**
     * Default configuration and theme values.
     *
     * @return array<string, mixed>
     */
    public static function defaults() {
        return array(
            'base_url'     => '',
            'api_key'      => '',
            'endpoint_id'  => '',
            'user_id'      => '',
            'timeout_ms'   => 30000,
            'theme'        => array(
                'primary_color'    => '#0f766e',
                'secondary_color'  => '#134e4a',
                'background_color' => '#f8fafc',
                'surface_color'    => '#ffffff',
                'text_color'       => '#0f172a',
                'muted_text_color' => '#64748b',
                'border_color'     => '#e2e8f0',
                'border_radius'    => '8px',
                'font_family'      => '"Source Sans 3", "Segoe UI", sans-serif',
                'font_size'        => '16px',
            ),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function all() {
        $stored = get_option(self::OPTION_KEY, array());
        if (!is_array($stored)) {
            $stored = array();
        }
        return array_replace_recursive(self::defaults(), $stored);
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function save($input) {
        $current = $this->all();
        $next    = array(
            'base_url'    => isset($input['base_url']) ? esc_url_raw(untrailingslashit($input['base_url'])) : $current['base_url'],
            'api_key'     => isset($input['api_key']) ? sanitize_text_field($input['api_key']) : $current['api_key'],
            'endpoint_id' => isset($input['endpoint_id']) ? sanitize_text_field($input['endpoint_id']) : $current['endpoint_id'],
            'user_id'     => isset($input['user_id']) ? sanitize_text_field($input['user_id']) : $current['user_id'],
            'timeout_ms'  => isset($input['timeout_ms']) ? absint($input['timeout_ms']) : (int) $current['timeout_ms'],
            'theme'       => $current['theme'],
        );

        if (isset($input['theme']) && is_array($input['theme'])) {
            foreach ($current['theme'] as $key => $default) {
                if (isset($input['theme'][$key])) {
                    $next['theme'][$key] = sanitize_text_field($input['theme'][$key]);
                }
            }
        }

        if ($next['timeout_ms'] < 1000) {
            $next['timeout_ms'] = 1000;
        }

        update_option(self::OPTION_KEY, $next);
        return $next;
    }

    /**
     * @return bool
     */
    public function is_ready() {
        $s = $this->all();
        return $s['base_url'] && $s['api_key'] && $s['endpoint_id'] && $s['user_id'];
    }

    /**
     * @return string
     */
    public function gateway_url() {
        $s = $this->all();
        return trailingslashit($s['base_url']) . 'api/v1/endpoints/' . rawurlencode($s['endpoint_id']) . '/' . rawurlencode($s['user_id']);
    }
}
