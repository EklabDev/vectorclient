<?php
/**
 * Theme helpers — CSS custom properties for embeds.
 */

if (!defined('ABSPATH')) {
    exit;
}

class VectorClient_Theme {
    /** @var VectorClient_Config */
    private $config;

    public function __construct(VectorClient_Config $config) {
        $this->config = $config;
    }

    /**
     * @return array<string, string>
     */
    public function css_variables() {
        $theme = $this->config->all()['theme'];
        return array(
            '--vc-primary'   => $theme['primary_color'],
            '--vc-secondary' => $theme['secondary_color'],
            '--vc-bg'        => $theme['background_color'],
            '--vc-surface'   => $theme['surface_color'],
            '--vc-text'      => $theme['text_color'],
            '--vc-muted'     => $theme['muted_text_color'],
            '--vc-border'    => $theme['border_color'],
            '--vc-radius'    => $theme['border_radius'],
            '--vc-font'      => $theme['font_family'],
            '--vc-font-size' => $theme['font_size'],
        );
    }

    /**
     * @return string
     */
    public function inline_style() {
        $parts = array();
        foreach ($this->css_variables() as $key => $value) {
            $parts[] = $key . ':' . $value;
        }
        return implode(';', $parts);
    }
}
