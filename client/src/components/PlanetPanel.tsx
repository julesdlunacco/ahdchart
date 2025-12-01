import React from 'react';
import { Activation } from '../services/HumanDesignLogic';
import { PLANET_ICON_FILES, ZODIAC_ICON_FILES, getIconUrl } from '../types';

interface PlanetPanelProps {
    activations: Record<string, Activation>;
    side: 'design' | 'personality';
    color: string;
    textColor?: string;
    fontFamily?: string;
    compact?: boolean;
}

// Get zodiac sign from longitude
const getZodiacSign = (longitude: number): string => {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
                   'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    const signIndex = Math.floor(longitude / 30) % 12;
    return signs[signIndex];
};

// Planet order for display
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
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.75;
};

// Icon component that uses SVG images
const Icon: React.FC<{ src: string; size: number; invert?: boolean }> = ({ src, size, invert }) => (
    <img 
        src={src} 
        alt="" 
        style={{ 
            width: size, 
            height: size, 
            objectFit: 'contain',
            filter: invert ? 'invert(1)' : 'none'
        }} 
    />
);

export const PlanetPanel: React.FC<PlanetPanelProps> = ({ 
    activations, 
    side, 
    color,
    textColor = '#333',
    fontFamily = 'system-ui, -apple-system, sans-serif',
    compact = false
}) => {
    const isDesign = side === 'design';
    const panelTextColor = isLightColor(color) ? '#000000' : '#ffffff';
    const invertIcons = !isLightColor(color);
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: compact ? '1px' : '2px',
            padding: compact ? '4px 2px' : '8px 4px',
            fontFamily,
            fontSize: compact ? '10px' : '12px',
        }}>
            <div style={{
                fontSize: compact ? '8px' : '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: textColor,
                opacity: 0.7,
                marginBottom: compact ? '2px' : '4px',
                textAlign: 'center'
            }}>
                {isDesign ? 'Design' : 'Personality'}
            </div>
            
            {PLANET_ORDER.map((planetName) => {
                const activation = activations[planetName];
                if (!activation) return null;
                
                const zodiacSign = getZodiacSign(activation.longitude);
                const planetIconFile = PLANET_ICON_FILES[planetName];
                const zodiacIconFile = ZODIAC_ICON_FILES[zodiacSign];
                
                return (
                    <div 
                        key={planetName}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: compact ? '2px' : '4px',
                            padding: compact ? '1px 2px' : '2px 4px',
                            borderRadius: '2px',
                            backgroundColor: color,
                            color: panelTextColor,
                            flexDirection: isDesign ? 'row' : 'row-reverse',
                            justifyContent: 'space-between',
                            minHeight: compact ? '16px' : '20px'
                        }}
                    >
                        {/* Planet icon */}
                        {planetIconFile && (
                            <span style={{ 
                                width: compact ? '12px' : '16px',
                                height: compact ? '12px' : '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Icon 
                                    src={getIconUrl(planetIconFile)} 
                                    size={compact ? 10 : 14} 
                                    invert={invertIcons}
                                />
                            </span>
                        )}

                        {/* Gate.Line */}
                        <span style={{ 
                            fontWeight: '600',
                            fontSize: compact ? '10px' : '12px',
                            minWidth: compact ? '32px' : '40px',
                            textAlign: 'center'
                        }}>
                            {activation.gate}.{activation.line}
                        </span>
                        
                        {/* Zodiac icon */}
                        {zodiacIconFile && (
                            <span style={{ 
                                width: compact ? '12px' : '16px',
                                height: compact ? '12px' : '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Icon 
                                    src={getIconUrl(zodiacIconFile)} 
                                    size={compact ? 10 : 14} 
                                    invert={invertIcons}
                                />
                            </span>
                        )}

                        {/* House number (hide in compact mode) */}
                        {!compact && activation.house && (
                            <span style={{ 
                                fontSize: '9px',
                                opacity: 0.7,
                                width: '14px',
                                textAlign: 'center',
                                flexShrink: 0
                            }}>
                                {activation.house}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
