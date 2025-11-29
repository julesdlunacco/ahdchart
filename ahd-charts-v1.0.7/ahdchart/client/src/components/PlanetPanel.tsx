import React from 'react';
import { Activation } from '../services/HumanDesignLogic';
import { PLANET_SYMBOLS, ZODIAC_SYMBOLS } from '../types';

interface PlanetPanelProps {
    activations: Record<string, Activation>;
    side: 'design' | 'personality';
    color: string;
    textColor?: string;
    fontFamily?: string;
}

// Get zodiac sign from longitude
const getZodiacSign = (longitude: number): string => {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
                   'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const signIndex = Math.floor(longitude / 30) % 12;
    return signs[signIndex];
};

// Planet order for display - including Chiron and Black Moon Lilith
const PLANET_ORDER = [
    'Sun', 'Earth', 'Moon', 'NorthNode', 'SouthNode',
    'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
    'Uranus', 'Neptune', 'Pluto', 'Chiron', 'Black Moon Lilith'
];

// Simple helper to decide if a hex color is "light"
const isLightColor = (hex: string): boolean => {
    if (!hex) return false;
    const raw = hex.replace('#', '');
    if (raw.length !== 6) return false;
    const r = parseInt(raw.substring(0, 2), 16);
    const g = parseInt(raw.substring(2, 4), 16);
    const b = parseInt(raw.substring(4, 6), 16);
    // Perceived luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.75; // treat very light colors as light
};

export const PlanetPanel: React.FC<PlanetPanelProps> = ({ 
    activations, 
    side, 
    color,
    textColor = '#333',
    fontFamily = 'system-ui, -apple-system, sans-serif'
}) => {
    const isDesign = side === 'design';
    const panelTextColor = isLightColor(color) ? '#000000' : '#ffffff';
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '12px 8px',
            fontFamily,
            fontSize: '13px',
            minWidth: '130px'
        }}>
            <div style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: textColor,
                opacity: 0.7,
                marginBottom: '4px',
                textAlign: 'center'
            }}>
                {isDesign ? 'Design' : 'Personality'}
            </div>
            
            {PLANET_ORDER.map(planetName => {
                const activation = activations[planetName];
                if (!activation) return null;
                
                const zodiacSign = getZodiacSign(activation.longitude);
                const zodiacSymbol = ZODIAC_SYMBOLS[zodiacSign] || '';
                const planetSymbol = PLANET_SYMBOLS[planetName] || planetName.charAt(0);
                const houseNum = activation.house;
                
                // Consistent layout: Planet symbol on outside, zodiac on inside
                // Design (left): Planet | Gate.Line | Zodiac | House
                // Personality (right): House | Zodiac | Gate.Line | Planet
                
                return (
                    <div 
                        key={planetName}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            backgroundColor: color,
                            color: panelTextColor,
                            flexDirection: isDesign ? 'row' : 'row-reverse',
                            justifyContent: 'space-between'
                        }}
                    >
                        {/* Planet symbol - always on outside */}
                        <span style={{ 
                            fontSize: '14px',
                            width: '18px',
                            textAlign: 'center',
                            flexShrink: 0
                        }}>
                            {planetSymbol}
                        </span>
                        
                        {/* Gate.Line */}
                        <span style={{ 
                            fontWeight: '600',
                            fontSize: '13px',
                            minWidth: '36px',
                            textAlign: 'center'
                        }}>
                            {activation.gate}.{activation.line}
                        </span>
                        
                        {/* Zodiac symbol - always on inside */}
                        <span style={{ 
                            fontSize: '13px',
                            opacity: 0.9,
                            width: '14px',
                            textAlign: 'center',
                            flexShrink: 0
                        }}>
                            {zodiacSymbol}
                        </span>
                        
                        {/* House number - on the innermost side */}
                        {houseNum && (
                            <span style={{ 
                                fontSize: '9px',
                                opacity: 0.8,
                                width: '12px',
                                textAlign: 'center',
                                flexShrink: 0
                            }}>
                                {houseNum}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
