<?php
/**
 * Settings page: API credentials + theme customization.
 */

if (!defined('ABSPATH')) {
    exit;
}

class VectorClient_Admin {
    /** @var VectorClient_Config */
    private $config;

    /** @var VectorClient_Theme */
    private $theme;

    public function __construct(VectorClient_Config $config, VectorClient_Theme $theme) {
        $this->config = $config;
        $this->theme  = $theme;
        add_action('admin_menu', array($this, 'register_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue'));
    }

    public function register_menu() {
        add_options_page(
            __('VectorClient', 'vectorclient'),
            __('VectorClient', 'vectorclient'),
            'manage_options',
            'vectorclient',
            array($this, 'render_page')
        );
    }

    public function register_settings() {
        register_setting(
            'vectorclient',
            VectorClient_Config::OPTION_KEY,
            array(
                'type'              => 'array',
                'sanitize_callback' => array($this, 'sanitize'),
            )
        );
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function sanitize($input) {
        return $this->config->save(is_array($input) ? $input : array());
    }

    public function enqueue($hook) {
        if ('settings_page_vectorclient' !== $hook) {
            return;
        }
        wp_enqueue_style(
            'vectorclient-admin',
            VECTORCLIENT_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            VECTORCLIENT_VERSION
        );
    }

    public function render_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $settings = $this->config->all();
        include VECTORCLIENT_PLUGIN_DIR . 'admin/views/settings-page.php';
    }
}
