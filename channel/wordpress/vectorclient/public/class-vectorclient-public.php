<?php
/**
 * Public shortcode + REST proxy (keeps API key server-side).
 */

if (!defined('ABSPATH')) {
    exit;
}

class VectorClient_Public {
    /** @var VectorClient_Config */
    private $config;

    /** @var VectorClient_Client */
    private $client;

    /** @var VectorClient_Theme */
    private $theme;

    public function __construct(
        VectorClient_Config $config,
        VectorClient_Client $client,
        VectorClient_Theme $theme
    ) {
        $this->config = $config;
        $this->client = $client;
        $this->theme  = $theme;

        add_action('wp_enqueue_scripts', array($this, 'register_assets'));
        add_action('rest_api_init', array($this, 'register_rest'));
        add_shortcode('vectorclient', array($this, 'shortcode'));
    }

    public function register_assets() {
        wp_register_style(
            'vectorclient-public',
            VECTORCLIENT_PLUGIN_URL . 'assets/css/public.css',
            array(),
            VECTORCLIENT_VERSION
        );
        wp_register_script(
            'vectorclient-public',
            VECTORCLIENT_PLUGIN_URL . 'assets/js/public.js',
            array(),
            VECTORCLIENT_VERSION,
            true
        );
    }

    public function register_rest() {
        register_rest_route(
            'vectorclient/v1',
            '/invoke',
            array(
                'methods'             => 'POST',
                'callback'            => array($this, 'rest_invoke'),
                'permission_callback' => '__return_true',
            )
        );
    }

    /**
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public function rest_invoke($request) {
        $payload = $request->get_json_params();
        if (!is_array($payload)) {
            $payload = array();
        }

        $result = $this->client->invoke($payload);
        $status = $result['ok'] ? 200 : ($result['status'] ?: 500);

        return new WP_REST_Response($result, $status);
    }

    /**
     * @param array<string, string> $atts
     * @return string
     */
    public function shortcode($atts) {
        $atts = shortcode_atts(
            array(
                'title'       => 'VectorClient',
                'placeholder' => '{"message":"Hello"}',
                'submit'      => 'Send',
            ),
            $atts,
            'vectorclient'
        );

        wp_enqueue_style('vectorclient-public');
        wp_enqueue_script('vectorclient-public');
        wp_localize_script(
            'vectorclient-public',
            'vectorClientPublic',
            array(
                'restUrl' => esc_url_raw(rest_url('vectorclient/v1/invoke')),
                'nonce'   => wp_create_nonce('wp_rest'),
            )
        );

        $style = esc_attr($this->theme->inline_style());
        $title = esc_html($atts['title']);
        $placeholder = esc_textarea($atts['placeholder']);
        $submit = esc_html($atts['submit']);

        return '<div class="vc-panel" style="' . $style . '">'
            . '<h3 class="vc-panel__title">' . $title . '</h3>'
            . '<form class="vc-panel__form" data-vc-form>'
            . '<textarea class="vc-panel__input" name="payload" rows="6">' . $placeholder . '</textarea>'
            . '<button class="vc-panel__submit" type="submit">' . $submit . '</button>'
            . '</form>'
            . '<p class="vc-panel__error" data-vc-error hidden></p>'
            . '<pre class="vc-panel__result" data-vc-result hidden></pre>'
            . '</div>';
    }
}
