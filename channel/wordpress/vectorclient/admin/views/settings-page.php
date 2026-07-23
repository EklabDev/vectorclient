<?php
/**
 * Settings page markup.
 *
 * @var array $settings
 */

if (!defined('ABSPATH')) {
    exit;
}

$theme = $settings['theme'];
?>
<div class="wrap vectorclient-settings">
    <h1><?php echo esc_html__('VectorClient Channel', 'vectorclient'); ?></h1>
    <p><?php echo esc_html__('Configure the public gateway credentials and widget theme. The API key stays on the server — shortcodes call a WordPress REST proxy.', 'vectorclient'); ?></p>

    <form method="post" action="options.php">
        <?php settings_fields('vectorclient'); ?>

        <h2><?php echo esc_html__('Gateway configuration', 'vectorclient'); ?></h2>
        <table class="form-table" role="presentation">
            <tr>
                <th scope="row"><label for="vc_base_url"><?php echo esc_html__('Base URL', 'vectorclient'); ?></label></th>
                <td>
                    <input class="regular-text" type="url" id="vc_base_url" name="<?php echo esc_attr(VectorClient_Config::OPTION_KEY); ?>[base_url]" value="<?php echo esc_attr($settings['base_url']); ?>" placeholder="https://your-api-gateway-domain.com" />
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="vc_api_key"><?php echo esc_html__('API key', 'vectorclient'); ?></label></th>
                <td>
                    <input class="regular-text" type="password" id="vc_api_key" name="<?php echo esc_attr(VectorClient_Config::OPTION_KEY); ?>[api_key]" value="<?php echo esc_attr($settings['api_key']); ?>" autocomplete="off" placeholder="sk_…" />
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="vc_endpoint_id"><?php echo esc_html__('Endpoint ID', 'vectorclient'); ?></label></th>
                <td>
                    <input class="regular-text" type="text" id="vc_endpoint_id" name="<?php echo esc_attr(VectorClient_Config::OPTION_KEY); ?>[endpoint_id]" value="<?php echo esc_attr($settings['endpoint_id']); ?>" />
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="vc_user_id"><?php echo esc_html__('User ID', 'vectorclient'); ?></label></th>
                <td>
                    <input class="regular-text" type="text" id="vc_user_id" name="<?php echo esc_attr(VectorClient_Config::OPTION_KEY); ?>[user_id]" value="<?php echo esc_attr($settings['user_id']); ?>" />
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="vc_timeout"><?php echo esc_html__('Timeout (ms)', 'vectorclient'); ?></label></th>
                <td>
                    <input type="number" min="1000" step="1000" id="vc_timeout" name="<?php echo esc_attr(VectorClient_Config::OPTION_KEY); ?>[timeout_ms]" value="<?php echo esc_attr((string) $settings['timeout_ms']); ?>" />
                </td>
            </tr>
        </table>

        <h2><?php echo esc_html__('Theme', 'vectorclient'); ?></h2>
        <table class="form-table" role="presentation">
            <?php
            $fields = array(
                'primary_color'    => __('Primary color', 'vectorclient'),
                'secondary_color'  => __('Secondary color', 'vectorclient'),
                'background_color' => __('Background', 'vectorclient'),
                'surface_color'    => __('Surface', 'vectorclient'),
                'text_color'       => __('Text', 'vectorclient'),
                'muted_text_color' => __('Muted text', 'vectorclient'),
                'border_color'     => __('Border', 'vectorclient'),
                'border_radius'    => __('Border radius', 'vectorclient'),
                'font_family'      => __('Font family', 'vectorclient'),
                'font_size'        => __('Font size', 'vectorclient'),
            );
            foreach ($fields as $key => $label) :
                $is_color = false !== strpos($key, 'color');
                ?>
                <tr>
                    <th scope="row"><label for="vc_theme_<?php echo esc_attr($key); ?>"><?php echo esc_html($label); ?></label></th>
                    <td>
                        <input
                            class="<?php echo $is_color ? 'vc-color' : 'regular-text'; ?>"
                            type="<?php echo $is_color ? 'color' : 'text'; ?>"
                            id="vc_theme_<?php echo esc_attr($key); ?>"
                            name="<?php echo esc_attr(VectorClient_Config::OPTION_KEY); ?>[theme][<?php echo esc_attr($key); ?>]"
                            value="<?php echo esc_attr($theme[$key]); ?>"
                        />
                    </td>
                </tr>
            <?php endforeach; ?>
        </table>

        <?php submit_button(__('Save settings', 'vectorclient')); ?>
    </form>

    <h2><?php echo esc_html__('Shortcode', 'vectorclient'); ?></h2>
    <p><code>[vectorclient title="Ask us" placeholder='{"message":"Hello"}']</code></p>
</div>
