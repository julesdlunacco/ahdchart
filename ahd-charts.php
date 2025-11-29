<?php
/**
 * Plugin Name: AHD Charts
 * Plugin URI:  https://lunacco.design
 * Description: Astrology and Human Design charts using Swiss Ephemeris WASM and React. Credits to Swiss Ephemeris: Created by Astrodienst AG
 * Version:     1.0.9
 * Author:      LunaCco
 * Text Domain: ahd-charts
 * Domain Path: /languages
 * License:     AGPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/agpl-3.0.html
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Define plugin constants
define( 'AHD_CHARTS_VERSION', '1.0.9' );
define( 'AHD_CHARTS_PATH', plugin_dir_path( __FILE__ ) );
define( 'AHD_CHARTS_URL', plugin_dir_url( __FILE__ ) );

require_once AHD_CHARTS_PATH . 'includes/class-ahd-settings.php';

/**
 * Register the Shortcode
 */
function ahd_render_chart_shortcode( $atts ) {
	// Determine built asset from Vite manifest
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

	// Settings object for the frontend
	$db_settings = get_option( 'ahd_chart_settings', array() );
	$settings = array(
		'pluginUrl' => AHD_CHARTS_URL,
		'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
		'epheUrl'   => AHD_CHARTS_URL . 'assets/ephe/',
		'theme'     => $db_settings,
	);

	$root   = '<div id="ahd-root"></div>';
	$inline = '<script type="text/javascript">window.ahdSettings = ' . wp_json_encode( $settings ) . ';</script>';
	$script = '<script type="module" src="' . esc_url( $dist_url . $js_file ) . '"></script>';

	return $root . "\n" . $inline . "\n" . $script;
}
add_shortcode( 'ahd-chart', 'ahd_render_chart_shortcode' );

/**
 * Enqueue Scripts and Styles
 */
function ahd_charts_enqueue_scripts() {
	$manifest_path = AHD_CHARTS_PATH . 'client/dist/.vite/manifest.json';
	$dist_url      = AHD_CHARTS_URL . 'client/dist/';

	$css_file = 'assets/index.css';

	if ( file_exists( $manifest_path ) ) {
		$manifest = json_decode( file_get_contents( $manifest_path ), true );
		
		// Entry point is src/main.tsx
		if ( isset( $manifest['src/main.tsx'] ) ) {
			$entry = $manifest['src/main.tsx'];
			if ( isset( $entry['css'] ) && is_array( $entry['css'] ) ) {
				$css_file = $entry['css'][0];
			}
		}
	}

	wp_register_style( 
		'ahd-charts-styles', 
		$dist_url . $css_file, 
		array(), 
		AHD_CHARTS_VERSION 
	);
}
add_action( 'wp_enqueue_scripts', 'ahd_charts_enqueue_scripts' );

/**
 * Create Directory for Ephemeris files on activation
 */
function ahd_charts_activate() {
	$ephe_dir = AHD_CHARTS_PATH . 'assets/ephe/';
	if ( ! file_exists( $ephe_dir ) ) {
		mkdir( $ephe_dir, 0755, true );
	}
}
register_activation_hook( __FILE__, 'ahd_charts_activate' );

/**
 * Register REST routes for location search.
 */
function ahd_register_rest_routes() {
	register_rest_route(
		'ahd/v1',
		'/cities',
		array(
			'methods'  => 'GET',
			'callback' => 'ahd_cities_search',
			'args'     => array(
				'q' => array(
					'required'          => true,
					'sanitize_callback' => 'sanitize_text_field',
				),
			),
			'permission_callback' => '__return_true',
		)
	);
}
add_action( 'rest_api_init', 'ahd_register_rest_routes' );

/**
 * Search worldcities.csv for matching cities.
 *
 * @param WP_REST_Request $request Request.
 *
 * @return WP_REST_Response
 */
function ahd_cities_search( WP_REST_Request $request ) {
	$query = trim( $request->get_param( 'q' ) );
	if ( '' === $query ) {
		return rest_ensure_response( array() );
	}

	$file = AHD_CHARTS_PATH . 'Resources/Locations/worldcities.csv';
	if ( ! file_exists( $file ) ) {
		return new WP_REST_Response( array( 'error' => 'cities_file_missing' ), 500 );
	}

	$handle = fopen( $file, 'r' );
	if ( ! $handle ) {
		return new WP_REST_Response( array( 'error' => 'cities_file_unreadable' ), 500 );
	}

	// Skip header.
	fgetcsv( $handle );

	$results = array();
	$max     = 10;
	$q_lower = mb_strtolower( $query );

	while ( ( $row = fgetcsv( $handle ) ) !== false ) {
		if ( count( $row ) < 5 ) {
			continue;
		}

		list( $city, $admin_name, $country, $lat, $lng ) = $row;
		$haystack = mb_strtolower( $city . ' ' . $country . ' ' . $admin_name );
		if ( false === mb_strpos( $haystack, $q_lower ) ) {
			continue;
		}

		$results[] = array(
			'city'       => $city,
			'admin_name' => $admin_name,
			'country'    => $country,
			'latitude'   => (float) $lat,
			'longitude'  => (float) $lng,
		);

		if ( count( $results ) >= $max ) {
			break;
		}
	}

	fclose( $handle );

	return rest_ensure_response( $results );
}
