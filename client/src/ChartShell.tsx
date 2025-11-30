import { useState, useEffect } from 'react';
import App from './App';
import { TransitApp } from './TransitApp';
import { ConnectionApp } from './ConnectionApp';
import { TransitCompositeApp } from './TransitCompositeApp';
import { AppTheme } from './types';

type ChartMode = 'birth' | 'connection' | 'transit' | 'transit-birth';

const MODE_LABELS: Record<ChartMode, string> = {
    'birth': 'My Birth Chart',
    'connection': 'Connection Chart',
    'transit': 'Transit Chart',
    'transit-birth': 'Transit + Birth',
};

export function ChartShell() {
    const [mode, setMode] = useState<ChartMode>('birth');
    const [theme, setTheme] = useState<AppTheme | undefined>(undefined);

    useEffect(() => {
        if (window.ahdSettings && window.ahdSettings.theme) {
            setTheme(window.ahdSettings.theme);
        }
    }, []);

    return (
        <div className="ahd-chart-shell" style={{ fontFamily: theme?.fontFamily }}>
            {/* Mode Selector */}
            <div style={{ maxWidth: '600px', margin: '0 auto 1.5em', padding: '0 20px' }}>
                <select
                    value={mode}
                    onChange={e => setMode(e.target.value as ChartMode)}
                    style={{
                        width: '100%',
                        height: 'auto',                        
                        padding: '0.75em 2.5em 0.75em 1em',
                        fontSize: '1.1em',
                        fontWeight: 500,
                        borderRadius: '8px',
                        border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                        backgroundColor: theme?.inputBgColor || '#fff',
                        cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1em center',
                    }}
                >
                    {Object.entries(MODE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Render selected app */}
            {mode === 'birth' && <App />}
            {mode === 'connection' && <ConnectionApp />}
            {mode === 'transit' && <TransitApp />}
            {mode === 'transit-birth' && <TransitCompositeApp />}
        </div>
    );
}
