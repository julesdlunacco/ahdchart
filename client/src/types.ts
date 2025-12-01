export interface BirthData {
    name: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    location: string;
    latitude?: number;
    longitude?: number;
}

export interface ChartResult {
    sun: PlanetaryPosition;
    earth: PlanetaryPosition;
    moon: PlanetaryPosition;
    northNode: PlanetaryPosition;
    southNode: PlanetaryPosition;
    // Add more as we implement them
    type: string;
    strategy: string;
    authority: string;
    profile: string;
    definition: string;
}

export interface PlanetaryPosition {
    name: string;
    longitude: number;
    gate: number;
    line: number;
    formatted: string;
}

export interface AppTheme {
    centerColor?: string;
    strokeColor?: string;
    designColor?: string;
    personalityColor?: string;
    textColor?: string;
    arrowColor?: string;
    fontFamily?: string;
    fontSizeScale?: number;
    activeGateCircleColor?: string;
    bodygraphTextColor?: string;
    bodygraphActiveTextColor?: string;
    // Form styling
    formBgColor?: string;
    buttonBgColor?: string;
    buttonTextColor?: string;
    inputBgColor?: string;
    inputBorderColor?: string;
    // Connection / composite chart colors
    connectionElectromagneticColor?: string;
    connectionCompromiseColor?: string;
    connectionCompanionColor?: string;
    connectionDominanceColor?: string;
}

// Zodiac symbols for display (Unicode fallback)
export const ZODIAC_SYMBOLS: Record<string, string> = {
    'Aries': '♈',
    'Taurus': '♉',
    'Gemini': '♊',
    'Cancer': '♋',
    'Leo': '♌',
    'Virgo': '♍',
    'Libra': '♎',
    'Scorpio': '♏',
    'Sagittarius': '♐',
    'Capricorn': '♑',
    'Aquarius': '♒',
    'Pisces': '♓'
};

// Planet symbols for display (Unicode fallback)
export const PLANET_SYMBOLS: Record<string, string> = {
    'Sun': '☉',
    'Earth': '⊕',
    'Moon': '☽',
    'Mercury': '☿',
    'Venus': '♀',
    'Mars': '♂',
    'Jupiter': '♃',
    'Saturn': '♄',
    'Uranus': '♅',
    'Neptune': '♆',
    'Pluto': '♇',
    'NorthNode': '☊',
    'SouthNode': '☋',
    'Chiron': '⚷',
    'Black Moon Lilith': '⚸'
};

// Icon file names for SVG icons (in Resources/Icons folder)
export const ZODIAC_ICON_FILES: Record<string, string> = {
    'Aries': 'Aries.svg',
    'Taurus': 'Taurus.svg',
    'Gemini': 'Gemini.svg',
    'Cancer': 'Cancer.svg',
    'Leo': 'Leo.svg',
    'Virgo': 'Virgo.svg',
    'Libra': 'Libra.svg',
    'Scorpio': 'Scorpio.svg',
    'Sagittarius': 'Sagittarius.svg',
    'Capricorn': 'Capricorn.svg',
    'Aquarius': 'Aquarius.svg',
    'Pisces': 'Pisces.svg'
};

export const PLANET_ICON_FILES: Record<string, string> = {
    'Sun': 'Sun.svg',
    'Earth': 'Earth.svg',
    'Moon': 'Moon.svg',
    'Mercury': 'Mercury.svg',
    'Venus': 'Venus.svg',
    'Mars': 'Mars.svg',
    'Jupiter': 'Jupiter.svg',
    'Saturn': 'Saturn.svg',
    'Uranus': 'Uranus.svg',
    'Neptune': 'Neptune.svg',
    'Pluto': 'Pluto.svg',
    'NorthNode': 'North Node.svg',
    'SouthNode': 'South Node.svg',
    'Chiron': 'Chiron.svg',
    'Black Moon Lilith': 'BlackMoon Lilith.svg'
};

// Helper to get icon URL
export const getIconUrl = (iconFile: string): string => {
    const pluginUrl = (window as any).ahdSettings?.pluginUrl || '';
    return `${pluginUrl}Resources/Icons/${iconFile}`;
};
