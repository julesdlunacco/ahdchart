import { useState, useEffect } from 'react';
import { Bodygraph } from './components/Bodygraph';
import { EphemerisService } from './services/EphemerisService';
import { ChartData } from './services/HumanDesignLogic';
import { AppTheme } from './types';

const ephemerisService = new EphemerisService('assets/ephe'); // Path ignored currently

export const SettingsApp = () => {
    const [theme, setTheme] = useState<AppTheme>({
        centerColor: '#fbbf24',
        strokeColor: '#000000',
        designColor: '#ef4444',
        personalityColor: '#000000',
        textColor: '#000000',
        arrowColor: '#000000',
        fontFamily: 'sans-serif',
        activeGateCircleColor: '#ffffff',
        bodygraphTextColor: '#000000',
        bodygraphActiveTextColor: '#000000',
        // Form styling defaults
        formBgColor: '#ffffff',
        buttonBgColor: '#10b981',
        buttonTextColor: '#ffffff',
        inputBgColor: '#ffffff',
        inputBorderColor: '#d1d5db'
    });
    const [previewData, setPreviewData] = useState<ChartData | null>(null);
    const [saving, setSaving] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [presets, setPresets] = useState<Array<{ name: string; theme: AppTheme }>>([]);

    useEffect(() => {
        if (window.ahdAdminSettings && window.ahdAdminSettings.settings) {
            setTheme(prev => ({ ...prev, ...window.ahdAdminSettings?.settings }));
        }

        // Load any locally saved presets for convenience
        try {
            const stored = window.localStorage.getItem('ahd_theme_presets');
            if (stored) {
                const parsed = JSON.parse(stored) as Array<{ name: string; theme: AppTheme }>;
                setPresets(parsed);
            }
        } catch (e) {
            console.warn('Failed to load theme presets from localStorage', e);
        }

        // Generate preview data
        const dummyInput = {
            name: 'Preview',
            date: '1989-01-22',
            time: '17:50',
            location: 'Geneva, New York, United States',
            timezone: 'America/New_York',
            latitude: '42.8645',
            longitude: '-76.9826'
        };
        ephemerisService.getChartData(dummyInput).then(data => setPreviewData(data));
    }, []);

    const handleChange = (key: keyof AppTheme, value: string) => {
        setTheme(prev => ({ ...prev, [key]: value }));
    };

    const handleHexChange = (key: keyof AppTheme, value: string) => {
        let next = value.trim();
        if (next && !next.startsWith('#')) {
            next = '#' + next;
        }
        setTheme(prev => ({ ...prev, [key]: next }));
    };

    const handleSavePreset = () => {
        const name = presetName.trim() || 'Unnamed Theme';
        const updated = [...presets.filter(p => p.name !== name), { name, theme }];
        setPresets(updated);
        try {
            window.localStorage.setItem('ahd_theme_presets', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save theme presets to localStorage', e);
        }
    };

    const handleLoadPreset = (name: string) => {
        const found = presets.find(p => p.name === name);
        if (found) {
            setTheme(found.theme);
            setPresetName(found.name);
        }
    };

    const handleSave = async () => {
        if (!window.ahdAdminSettings) return;
        setSaving(true);
        
        const formData = new FormData();
        formData.append('action', 'ahd_save_settings');
        formData.append('nonce', window.ahdAdminSettings.nonce);
        formData.append('settings', JSON.stringify(theme));

        try {
            const res = await fetch(window.ahdAdminSettings.ajaxUrl, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert('Settings saved!');
            } else {
                alert('Error saving settings: ' + data.data);
            }
        } catch (e) {
            console.error(e);
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="wrap" style={{ fontFamily: theme.fontFamily}}>
            <h1>AHD Charts Settings</h1>
            <div style={{ marginTop: '40px', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 320px' }}>
                    <h2>Theme Customization</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Local presets (browser only) */}
                        <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Theme Presets (local)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Preset name" 
                                    value={presetName}
                                    onChange={e => setPresetName(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button type="button" className="button" onClick={handleSavePreset}>
                                    Save Preset
                                </button>
                            </div>
                            {presets.length > 0 && (
                                <select 
                                    value=""
                                    onChange={e => { if (e.target.value) handleLoadPreset(e.target.value); }}
                                    style={{ width: '100%' }}
                                >
                                    <option value="">Load preset…</option>
                                    {presets.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Center Fill Color</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.centerColor} onChange={e => handleChange('centerColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.centerColor}
                                    onChange={e => handleHexChange('centerColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Stroke Color</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.strokeColor} onChange={e => handleChange('strokeColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.strokeColor}
                                    onChange={e => handleHexChange('strokeColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Design Color (Red)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.designColor} onChange={e => handleChange('designColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.designColor}
                                    onChange={e => handleHexChange('designColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#ef4444"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Personality Color (Black)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.personalityColor} onChange={e => handleChange('personalityColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.personalityColor}
                                    onChange={e => handleHexChange('personalityColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Arrow Color</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.arrowColor || '#000000'} onChange={e => handleChange('arrowColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.arrowColor || ''}
                                    onChange={e => handleHexChange('arrowColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>General Text Color</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.textColor || '#000000'} onChange={e => handleChange('textColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.textColor || ''}
                                    onChange={e => handleHexChange('textColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Bodygraph Gate Text (Inactive)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.bodygraphTextColor || theme.textColor || '#000000'} onChange={e => handleChange('bodygraphTextColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.bodygraphTextColor || ''}
                                    onChange={e => handleHexChange('bodygraphTextColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Bodygraph Gate Text (Active)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.bodygraphActiveTextColor || theme.bodygraphTextColor || theme.textColor || '#000000'} onChange={e => handleChange('bodygraphActiveTextColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.bodygraphActiveTextColor || ''}
                                    onChange={e => handleHexChange('bodygraphActiveTextColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Active Gate Circle Color</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.activeGateCircleColor || '#ffffff'} onChange={e => handleChange('activeGateCircleColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.activeGateCircleColor || ''}
                                    onChange={e => handleHexChange('activeGateCircleColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Font Family</label>
                            <select value={theme.fontFamily} onChange={e => handleChange('fontFamily', e.target.value)} style={{ width: '100%' }}>
                                <option value="sans-serif">Sans Serif</option>
                                <option value="serif">Serif</option>
                                <option value="monospace">Monospace</option>
                                <option value="Arial">Arial</option>
                                <option value="Helvetica">Helvetica</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                                <option value="system-ui, -apple-system, sans-serif">System UI</option>
                            </select>
                        </div>

                        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>Form Styling</h3>
                        
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Button Background</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.buttonBgColor || '#10b981'} onChange={e => handleChange('buttonBgColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.buttonBgColor || ''}
                                    onChange={e => handleHexChange('buttonBgColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#10b981"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Button Text Color</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.buttonTextColor || '#ffffff'} onChange={e => handleChange('buttonTextColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.buttonTextColor || ''}
                                    onChange={e => handleHexChange('buttonTextColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Form Background</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.formBgColor || '#ffffff'} onChange={e => handleChange('formBgColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.formBgColor || ''}
                                    onChange={e => handleHexChange('formBgColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Input Background</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.inputBgColor || '#ffffff'} onChange={e => handleChange('inputBgColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.inputBgColor || ''}
                                    onChange={e => handleHexChange('inputBgColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#ffffff"
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Input Border Color</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="color" value={theme.inputBorderColor || '#d1d5db'} onChange={e => handleChange('inputBorderColor', e.target.value)} />
                                <input
                                    type="text"
                                    value={theme.inputBorderColor || ''}
                                    onChange={e => handleHexChange('inputBorderColor', e.target.value)}
                                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                    placeholder="#d1d5db"
                                />
                            </div>
                        </div>

                        <button 
                            className="button button-primary" 
                            onClick={handleSave} 
                            disabled={saving}
                            style={{ marginTop: '1.5rem' }}
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: '300px', border: '1px solid #ddd', padding: '1rem', background: '#fff' }}>
                    <h2>Live Preview</h2>
                    <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Bodygraph</h3>
                            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                                <Bodygraph data={previewData} theme={theme} />
                            </div>
                        </div>

                        <div>
                            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Form Preview</h3>
                            <div
                                style={{
                                    padding: '1rem',
                                    borderRadius: '0.5rem',
                                    backgroundColor: theme.formBgColor || '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.8rem' }}>Name</label>
                                    <input
                                        type="text"
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '0.375rem',
                                            border: `1px solid ${theme.inputBorderColor || '#d1d5db'}`,
                                            backgroundColor: theme.inputBgColor || '#ffffff'
                                        }}
                                        placeholder="Your name"
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.8rem' }}>Date</label>
                                    <input
                                        type="date"
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '0.375rem',
                                            border: `1px solid ${theme.inputBorderColor || '#d1d5db'}`,
                                            backgroundColor: theme.inputBgColor || '#ffffff'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0.5rem 0.9rem',
                                            borderRadius: '0.5rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: theme.buttonBgColor || '#10b981',
                                            color: theme.buttonTextColor || '#ffffff',
                                            fontSize: '0.8rem',
                                            fontWeight: 500
                                        }}
                                    >
                                        Generate Chart
                                    </button>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0.5rem 0.9rem',
                                            borderRadius: '0.5rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: theme.buttonBgColor || '#3b82f6',
                                            color: theme.buttonTextColor || '#ffffff',
                                            fontSize: '0.8rem',
                                            fontWeight: 500
                                        }}
                                    >
                                        Saved Charts
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
