<?php
/**
 * Plugin Name: VectorClient Channel
 * Description: Native WordPress integration for the VectorClient API Gateway — config, theme, shortcode, and REST proxy.
 * Version: 1.0.0
 * Author: VectorClient
 * Text Domain: vectorclient
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('VECTORCLIENT_VERSION', '1.0.0');
define('VECTORCLIENT_PLUGIN_FILE', __FILE__);
define('VECTORCLIENT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('VECTORCLIENT_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once VECTORCLIENT_PLUGIN_DIR . 'includes/class-vectorclient-config.php';
require_once VECTORCLIENT_PLUGIN_DIR . 'includes/class-vectorclient-client.php';
require_once VECTORCLIENT_PLUGIN_DIR . 'includes/class-vectorclient-theme.php';
require_once VECTORCLIENT_PLUGIN_DIR . 'admin/class-vectorclient-admin.php';
require_once VECTORCLIENT_PLUGIN_DIR . 'public/class-vectorclient-public.php';

/**
 * Bootstrap plugin.
 */
function vectorclient_bootstrap() {
    $config = new VectorClient_Config();
    $client = new VectorClient_Client($config);
    $theme  = new VectorClient_Theme($config);

    if (is_admin()) {
        new VectorClient_Admin($config, $theme);
    }

    new VectorClient_Public($config, $client, $theme);
}
add_action('plugins_loaded', 'vectorclient_bootstrap');

register_activation_hook(__FILE__, function () {
    if (false === get_option(VectorClient_Config::OPTION_KEY, false)) {
        add_option(VectorClient_Config::OPTION_KEY, VectorClient_Config::defaults());
    }
});
