import React from 'react';
import { Activation } from '../services/HumanDesignLogic';
import { PLANET_ICON_FILES, ZODIAC_ICON_FILES, getIconUrl } from '../types';

interface ConnectionPlanetPanelProps {
    activationsA: Record<string, Activation>;
    activationsB: Record<string, Activation>;
    side: 'design' | 'personality';
    colorA: string;
    colorB: string;
    fontFamily?: string;
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
    return luminance > 0.6;
};

// Icon component
const Icon: React.FC<{ src: string; size: number }> = ({ src, size }) => (
    <img 
        src={src} 
        alt="" 
        style={{ 
            width: size, 
            height: size, 
            objectFit: 'contain'
        }} 
    />
);

/**
 * ConnectionPlanetPanel - Shows both people's planets side by side
 * Layout: House (A) | Zodiac (A) | Gate.Line (A) | Planet | Gate.Line (B) | Zodiac (B) | House (B)
 */
export const ConnectionPlanetPanel: React.FC<ConnectionPlanetPanelProps> = ({ 
    activationsA, 
    activationsB, 
    side, 
    colorA,
    colorB,
    fontFamily = 'system-ui, -apple-system, sans-serif'
}) => {
    // Chart A is always on the left, Chart B always on the right.
    // The `side` prop is only used for the section label (Design / Personality).
    const leftActivations = activationsA;
    const rightActivations = activationsB;
    const leftColor = colorA;
    const rightColor = colorB;
    
    // Determine text colors based on background lightness
    const leftTextColor = isLightColor(leftColor) ? '#000' : '#fff';
    const rightTextColor = isLightColor(rightColor) ? '#000' : '#fff';
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            fontFamily,
            fontSize: '10px',
        }}>
            <div style={{
                fontSize: '8px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#666',
                marginBottom: '2px',
                textAlign: 'center'
            }}>
                {side === 'design' ? 'Design' : 'Personality'}
            </div>
            
            {PLANET_ORDER.map((planetName) => {
                const leftAct = leftActivations[planetName];
                const rightAct = rightActivations[planetName];
                if (!leftAct && !rightAct) return null;
                
                const leftZodiac = leftAct ? getZodiacSign(leftAct.longitude) : '';
                const rightZodiac = rightAct ? getZodiacSign(rightAct.longitude) : '';
                const planetIconFile = PLANET_ICON_FILES[planetName];
                const leftZodiacFile = leftZodiac ? ZODIAC_ICON_FILES[leftZodiac] : null;
                const rightZodiacFile = rightZodiac ? ZODIAC_ICON_FILES[rightZodiac] : null;
                
                return (
                    <div 
                        key={planetName}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1px',
                            minHeight: '15px',
                            justifyContent: 'center'
                        }}
                    >
                        {/* Left House */}
                        <span style={{ 
                            fontSize: '7px',
                            color: '#888',
                            width: '12px',
                            textAlign: 'center',
                            flexShrink: 0
                        }}>
                            {leftAct?.house || ''}
                        </span>

                        {/* Left Zodiac icon */}
                        <span style={{ 
                            width: '11px',
                            height: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {leftZodiacFile && (
                                <Icon src={getIconUrl(leftZodiacFile)} size={9} />
                            )}
                        </span>

                        {/* Left person's Gate.Line */}
                        <span style={{ 
                            fontWeight: '600',
                            fontSize: '9px',
                            minWidth: '30px',
                            textAlign: 'center',
                            padding: '1px 2px',
                            borderRadius: '2px',
                            backgroundColor: leftAct ? leftColor : 'transparent',
                            color: leftAct ? leftTextColor : 'transparent'
                        }}>
                            {leftAct ? `${leftAct.gate}.${leftAct.line}` : ''}
                        </span>
                        
                        {/* Planet icon (center) */}
                        <span style={{ 
                            width: '14px',
                            height: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            margin: '0 2px'
                        }}>
                            {planetIconFile && (
                                <Icon src={getIconUrl(planetIconFile)} size={12} />
                            )}
                        </span>

                        {/* Right person's Gate.Line */}
                        <span style={{ 
                            fontWeight: '600',
                            fontSize: '9px',
                            minWidth: '30px',
                            textAlign: 'center',
                            padding: '1px 2px',
                            borderRadius: '2px',
                            backgroundColor: rightAct ? rightColor : 'transparent',
                            color: rightAct ? rightTextColor : 'transparent'
                        }}>
                            {rightAct ? `${rightAct.gate}.${rightAct.line}` : ''}
                        </span>
                        
                        {/* Right Zodiac icon */}
                        <span style={{ 
                            width: '11px',
                            height: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {rightZodiacFile && (
                                <Icon src={getIconUrl(rightZodiacFile)} size={9} />
                            )}
                        </span>

                        {/* Right House */}
                        <span style={{ 
                            fontSize: '7px',
                            color: '#888',
                            width: '12px',
                            textAlign: 'center',
                            flexShrink: 0
                        }}>
                            {rightAct?.house || ''}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
