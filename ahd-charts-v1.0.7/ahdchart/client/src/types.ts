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
    activeGateCircleColor?: string;
    bodygraphTextColor?: string;
    bodygraphActiveTextColor?: string;
    // Form styling
    formBgColor?: string;
    buttonBgColor?: string;
    buttonTextColor?: string;
    inputBgColor?: string;
    inputBorderColor?: string;
}

// Zodiac symbols for display
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

// Planet symbols for display
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
