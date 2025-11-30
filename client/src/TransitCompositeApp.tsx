import { useState, useEffect } from 'react';
import { Bodygraph } from './components/Bodygraph';
import { PlanetPanel } from './components/PlanetPanel';
import { ChartData, Activation, HumanDesignLogic } from './services/HumanDesignLogic';
import { EphemerisService } from './services/EphemerisService';
import { ConnectionLogic, ConnectionAnalysis } from './services/ConnectionLogic';
import { AppTheme } from './types';

const ephemerisService = new EphemerisService('assets/ephe');

// Saved chart structure (matches App.tsx)
interface SavedChart {
    id: number;
    name: string;
    date: string;
    input: {
        name: string;
        date: string;
        time: string;
        location: string;
        timezone: string;
        latitude: string;
        longitude: string;
    };
    report: string;
    chartData?: ChartData;
}

export function TransitCompositeApp() {
    const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
    const [selectedBirth, setSelectedBirth] = useState<number | null>(null);
    const [birthChart, setBirthChart] = useState<ChartData | null>(null);
    const [transitChart, setTransitChart] = useState<ChartData | null>(null);
    const [compositeData, setCompositeData] = useState<ChartData | null>(null);
    const [connectionAnalysis, setConnectionAnalysis] = useState<ConnectionAnalysis | null>(null);
    const [theme, setTheme] = useState<AppTheme | undefined>(undefined);
    const [showResults, setShowResults] = useState(false);
    const [loading, setLoading] = useState(false);

    // Transit date/time (UTC)
    const now = new Date();
    const [transitDate, setTransitDate] = useState(
        `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    );
    const [transitTime, setTransitTime] = useState(
        `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
    );

    // Load saved charts and theme on mount
    useEffect(() => {
        if (window.ahdSettings && window.ahdSettings.theme) {
            setTheme(window.ahdSettings.theme);
        }
        const stored = localStorage.getItem('ahd_saved_charts');
        if (stored) {
            const parsed = JSON.parse(stored) as SavedChart[];
            // Rehydrate Sets
            const rehydrated = parsed.map(c => {
                if (c.chartData) {
                    const raw: any = c.chartData;
                    c.chartData = {
                        ...raw,
                        definedCenters: raw.definedCenters instanceof Set
                            ? raw.definedCenters
                            : new Set(Array.isArray(raw.definedCenters) ? raw.definedCenters : []),
                        activeGates: raw.activeGates instanceof Set
                            ? raw.activeGates
                            : new Set(Array.isArray(raw.activeGates) ? raw.activeGates : []),
                    };
                }
                return c;
            });
            setSavedCharts(rehydrated);
        }
    }, []);

    // When birth selection changes, load the chart data (recalculate if not cached)
    useEffect(() => {
        const loadBirthChart = async () => {
            if (selectedBirth === null) {
                setBirthChart(null);
                return;
            }
            const chart = savedCharts.find(c => c.id === selectedBirth);
            if (!chart) {
                setBirthChart(null);
                return;
            }
            if (chart.chartData) {
                setBirthChart(chart.chartData);
            } else {
                // Recalculate if chartData wasn't saved
                setLoading(true);
                try {
                    const dataObj = await ephemerisService.getChartData(chart.input);
                    setBirthChart(dataObj);
                } catch (e) {
                    console.error('Error loading birth chart:', e);
                    setBirthChart(null);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadBirthChart();
    }, [selectedBirth, savedCharts]);

    const handleGenerate = async () => {
        if (!birthChart) return;

        setLoading(true);
        try {
            // Calculate transit chart at UTC 0/0
            const payload = {
                name: 'Transit',
                date: transitDate,
                time: transitTime,
                location: 'Transit (UTC, 0° lat, 0° lon)',
                timezone: 'UTC',
                latitude: '0',
                longitude: '0',
            };

            const transitDataObj = await ephemerisService.getChartData(payload);

            // Build personality-only transit chart
            const designClone: Record<string, Activation> = {};
            ['Sun', 'NorthNode'].forEach(name => {
                const act = transitDataObj.birthActivations[name];
                if (act) {
                    designClone[name] = { ...act };
                }
            });

            const transitOnlyChart = HumanDesignLogic.determineChartProperties(
                transitDataObj.birthActivations,
                designClone
            );

            const taggedTransit: ChartData = {
                ...transitOnlyChart,
                birthActivations: transitDataObj.birthActivations,
                designActivations: {},
                isTransit: true,
            } as any;

            setTransitChart(taggedTransit);

            // Run connection analysis between birth and transit
            const analysis = ConnectionLogic.classifyChannels(birthChart, taggedTransit);
            setConnectionAnalysis(analysis);

            // Build composite ChartData using analysis results
            const compositeBirthActivations: Record<string, Activation> = {};
            Object.entries(birthChart.birthActivations).forEach(([k, v]) => {
                compositeBirthActivations[`Birth_${k}`] = v;
            });
            Object.entries(taggedTransit.birthActivations).forEach(([k, v]) => {
                compositeBirthActivations[`Transit_${k}`] = v;
            });

            const compositeDesignActivations: Record<string, Activation> = {};
            Object.entries(birthChart.designActivations).forEach(([k, v]) => {
                compositeDesignActivations[`Birth_${k}`] = v;
            });

            const composite: ChartData = {
                birthActivations: compositeBirthActivations,
                designActivations: compositeDesignActivations,
                activeGates: analysis.compositeGates,           // All gates from both
                activeChannels: analysis.compositeChannels,     // All complete channels
                definedCenters: analysis.compositeCenters.definedCenters,
                type: birthChart.type,
                authority: birthChart.authority,
                profile: birthChart.profile,
                variables: birthChart.variables,
                definition: `Transit Composite (${analysis.compositeCenters.code})`,
                incarnationCross: '',
                modality: '',
            };

            setCompositeData(composite);
            setShowResults(true);
        } catch (error) {
            console.error('Error generating transit composite:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setShowResults(false);
        setCompositeData(null);
        setConnectionAnalysis(null);
        setTransitChart(null);
    };

    const getChartName = (id: number | null) => {
        if (id === null) return 'Not selected';
        const chart = savedCharts.find(c => c.id === id);
        return chart?.name || 'Unknown';
    };

    // Render selection form
    if (!showResults) {
        return (
            <div className="ahd-transit-composite-app" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: theme?.fontFamily }}>
                <h1 style={{ textAlign: 'center', marginBottom: '1.5em' }}>Transit + Birth Chart</h1>

                {savedCharts.length < 1 ? (
                    <div style={{ textAlign: 'center', padding: '2em', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                        <p style={{ margin: 0, color: '#92400e' }}>
                            You need at least 1 saved birth chart to create a transit composite.
                        </p>
                        <p style={{ margin: '0.5em 0 0', color: '#92400e', fontSize: '0.9em' }}>
                            Go to the Birth Chart page and save a chart first.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2em' }}>
                        {/* Birth Chart Selection */}
                        <div style={{ padding: '1.5em', backgroundColor: theme?.formBgColor || '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ margin: '0 0 1em', color: theme?.textColor || '#1f2937' }}>Birth Chart</h3>
                            <select
                                value={selectedBirth ?? ''}
                                onChange={e => setSelectedBirth(e.target.value ? Number(e.target.value) : null)}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    padding: '0.75em 2em 0.75em 0.75em',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                    backgroundColor: theme?.inputBgColor || '#fff',
                                    fontSize: '1em',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.75em center',
                                }}
                            >
                                <option value="">Select a saved chart...</option>
                                {savedCharts.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.input.date})
                                    </option>
                                ))}
                            </select>
                            {birthChart && (
                                <div style={{ marginTop: '1em' }}>
                                    <Bodygraph data={birthChart} theme={theme} mini />
                                </div>
                            )}
                        </div>

                        {/* Transit Date/Time */}
                        <div style={{ padding: '1.5em', backgroundColor: theme?.formBgColor || '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ margin: '0 0 1em', color: theme?.textColor || '#1f2937' }}>Transit (UTC)</h3>
                            <div style={{ display: 'flex', gap: '1em', marginBottom: '1em' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5em', fontSize: '0.9em' }}>Date</label>
                                    <input
                                        type="date"
                                        value={transitDate}
                                        onChange={e => setTransitDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.5em',
                                            borderRadius: '6px',
                                            border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                            backgroundColor: theme?.inputBgColor || '#fff',
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5em', fontSize: '0.9em' }}>Time</label>
                                    <input
                                        type="time"
                                        value={transitTime}
                                        onChange={e => setTransitTime(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.5em',
                                            borderRadius: '6px',
                                            border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                            backgroundColor: theme?.inputBgColor || '#fff',
                                        }}
                                    />
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8em', color: '#6b7280' }}>
                                Transit calculated at 0° lat, 0° lon (Null Island) in UTC.
                            </p>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '2em' }}>
                    <button
                        onClick={handleGenerate}
                        disabled={!birthChart || loading}
                        style={{
                            padding: '0.75em 2em',
                            backgroundColor: (!birthChart || loading) ? '#9ca3af' : (theme?.buttonBgColor || '#10b981'),
                            color: theme?.buttonTextColor || '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1em',
                            fontWeight: 600,
                            cursor: (!birthChart || loading) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? 'Calculating...' : 'Generate Transit + Birth'}
                    </button>
                </div>
            </div>
        );
    }

    // Render results: 3-bodygraph layout
    const themeCode = connectionAnalysis?.compositeCenters.code || '';

    return (
        <div className="ahd-transit-composite-results" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: theme?.fontFamily }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5em' }}>
                <div>
                    <h2 style={{ margin: 0, color: theme?.textColor || '#1f2937' }}>
                        {getChartName(selectedBirth)} + Transit ({transitDate} {transitTime} UTC)
                    </h2>
                    <p style={{ margin: '0.25em 0 0', color: '#6b7280', fontSize: '0.9em' }}>
                        Composite Theme: <strong>{themeCode}</strong>
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    style={{
                        padding: '0.5em 1em',
                        backgroundColor: '#6b7280',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    New Composite
                </button>
            </div>

            {/* 3-column layout: Birth | Composite | Transit */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '1.5em', alignItems: 'flex-start' }}>
                {/* Birth Chart */}
                <div style={{ backgroundColor: '#fff', padding: '1em', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: '0 0 0.75em', fontSize: '1em', color: theme?.textColor || '#1f2937' }}>
                        {getChartName(selectedBirth)}
                    </h3>
                    {birthChart && (
                        <>
                            <Bodygraph data={birthChart} theme={theme} mini />
                            <div style={{ marginTop: '1em' }}>
                                <PlanetPanel
                                    activations={birthChart.birthActivations}
                                    side="personality"
                                    color={theme?.personalityColor || '#000'}
                                    textColor={theme?.textColor || '#111827'}
                                    fontFamily={theme?.fontFamily}
                                />
                                <PlanetPanel
                                    activations={birthChart.designActivations}
                                    side="design"
                                    color={theme?.designColor || '#ff0000'}
                                    textColor={theme?.textColor || '#111827'}
                                    fontFamily={theme?.fontFamily}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Composite Center */}
                <div style={{ backgroundColor: '#fff', padding: '1em', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: '0 0 0.75em', fontSize: '1em', color: theme?.textColor || '#1f2937', textAlign: 'center' }}>
                        Transit Composite
                    </h3>
                    {compositeData && connectionAnalysis && (
                        <>
                            <Bodygraph data={compositeData} connectionAnalysis={connectionAnalysis} theme={theme} />

                            {/* Connection Legend */}
                            <div style={{ marginTop: '1em', padding: '0.75em', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '0.85em' }}>
                                <div style={{ fontWeight: 600, marginBottom: '0.5em' }}>What the Transit Activates:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1em' }}>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionElectromagneticColor || '#8b5cf6', borderRadius: 2, marginRight: 4 }}></span> Electromagnetic ({connectionAnalysis.electromagnetic.length})</span>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionCompromiseColor || '#f59e0b', borderRadius: 2, marginRight: 4 }}></span> Compromise ({connectionAnalysis.compromise.length})</span>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionCompanionColor || '#3b82f6', borderRadius: 2, marginRight: 4 }}></span> Companion ({connectionAnalysis.companion.length})</span>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionDominanceColor || '#10b981', borderRadius: 2, marginRight: 4 }}></span> Dominance ({connectionAnalysis.dominance.length})</span>
                                </div>
                            </div>

                            {/* Channel Lists */}
                            <div style={{ marginTop: '1em', fontSize: '0.85em' }}>
                                {connectionAnalysis.electromagnetic.length > 0 && (
                                    <div style={{ marginBottom: '0.75em' }}>
                                        <strong style={{ color: theme?.connectionElectromagneticColor || '#8b5cf6' }}>Electromagnetic:</strong>
                                        <span style={{ marginLeft: '0.5em' }}>{connectionAnalysis.electromagnetic.map(c => c.id).join(', ')}</span>
                                    </div>
                                )}
                                {connectionAnalysis.compromise.length > 0 && (
                                    <div style={{ marginBottom: '0.75em' }}>
                                        <strong style={{ color: theme?.connectionCompromiseColor || '#f59e0b' }}>Compromise:</strong>
                                        <span style={{ marginLeft: '0.5em' }}>{connectionAnalysis.compromise.map(c => c.id).join(', ')}</span>
                                    </div>
                                )}
                                {connectionAnalysis.companion.length > 0 && (
                                    <div style={{ marginBottom: '0.75em' }}>
                                        <strong style={{ color: theme?.connectionCompanionColor || '#3b82f6' }}>Companion:</strong>
                                        <span style={{ marginLeft: '0.5em' }}>{connectionAnalysis.companion.map(c => c.id).join(', ')}</span>
                                    </div>
                                )}
                                {connectionAnalysis.dominance.length > 0 && (
                                    <div style={{ marginBottom: '0.75em' }}>
                                        <strong style={{ color: theme?.connectionDominanceColor || '#10b981' }}>Dominance:</strong>
                                        <span style={{ marginLeft: '0.5em' }}>{connectionAnalysis.dominance.map(c => c.id).join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Transit Chart */}
                <div style={{ backgroundColor: '#fff', padding: '1em', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: '0 0 0.75em', fontSize: '1em', color: theme?.textColor || '#1f2937' }}>
                        Transit ({transitDate})
                    </h3>
                    {transitChart && (
                        <>
                            <Bodygraph data={transitChart} theme={theme} mini />
                            <div style={{ marginTop: '1em' }}>
                                <PlanetPanel
                                    activations={transitChart.birthActivations}
                                    side="personality"
                                    color={theme?.personalityColor || '#000'}
                                    textColor={theme?.textColor || '#111827'}
                                    fontFamily={theme?.fontFamily}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
