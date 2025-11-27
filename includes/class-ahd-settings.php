<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class AHD_Charts_Settings {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'wp_ajax_ahd_save_settings', array( $this, 'save_settings' ) );
	}

	public function add_admin_menu() {
		add_menu_page(
			'AHD Charts Settings',
			'AHD Charts',
			'manage_options',
			'ahd-charts',
			array( $this, 'render_settings_page' ),
			'dashicons-chart-pie',
			20
		);
	}

	public function enqueue_scripts( $hook ) {
		if ( 'toplevel_page_ahd-charts' !== $hook ) {
			return;
		}

		$manifest_path = AHD_CHARTS_PATH . 'client/dist/.vite/manifest.json';
		$dist_url      = AHD_CHARTS_URL . 'client/dist/';
		$css_file      = 'assets/index.css';

		if ( file_exists( $manifest_path ) ) {
			$manifest = json_decode( file_get_contents( $manifest_path ), true );
			if ( isset( $manifest['src/main.tsx'] ) ) {
				$entry = $manifest['src/main.tsx'];
				if ( isset( $entry['css'] ) && is_array( $entry['css'] ) ) {
					$css_file = $entry['css'][0];
				}
			}
		}

		wp_enqueue_style( 'ahd-charts-style', $dist_url . $css_file, array(), AHD_CHARTS_VERSION );
	}

	public function render_settings_page() {
		$manifest_path = AHD_CHARTS_PATH . 'client/dist/.vite/manifest.json';
		$dist_url      = AHD_CHARTS_URL . 'client/dist/';
		$js_file       = 'assets/index.js';

		if ( file_exists( $manifest_path ) ) {
			$manifest = json_decode( file_get_contents( $manifest_path ), true );
			if ( isset( $manifest['src/main.tsx'] ) ) {
				$entry   = $manifest['src/main.tsx'];
				$js_file = $entry['file'];
			}
		}

		$settings = get_option( 'ahd_chart_settings', array() );
		$config   = array(
			'settings' => $settings,
			'nonce'    => wp_create_nonce( 'ahd_save_settings' ),
			'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
			'epheUrl'  => AHD_CHARTS_URL . 'assets/ephe/',
		);

		echo '<div class="wrap">';
		echo '<div id="ahd-settings-root"></div>';
		echo '<script type="text/javascript">window.ahdAdminSettings = ' . wp_json_encode( $config ) . ';</script>';
		echo '<script type="module" src="' . esc_url( $dist_url . $js_file ) . '"></script>';
		echo '</div>';
	}

	public function save_settings() {
		check_ajax_referer( 'ahd_save_settings', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized' );
		}

		$settings = isset( $_POST['settings'] ) ? json_decode( stripslashes( $_POST['settings'] ), true ) : array();
		update_option( 'ahd_chart_settings', $settings );
		wp_send_json_success( 'Settings saved' );
	}
}

new AHD_Charts_Settings();
