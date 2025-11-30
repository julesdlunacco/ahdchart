import { useState, useEffect } from 'react';
import { Bodygraph } from './components/Bodygraph';
import { PlanetPanel } from './components/PlanetPanel';
import { ChartData, Activation } from './services/HumanDesignLogic';
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

// Connection theme code descriptions
const CONNECTION_THEME_DESCRIPTIONS: Record<string, string> = {
    '9-0': 'Nowhere to Go – Total closure, deeply bonded but can feel stuck.',
    '8-1': 'Innovate Together – Strong synergy with one growth point.',
    '7-2': 'Work To Do – Two themes to resolve, evolutionary pairing.',
    '6-3': 'Growth Is Required – Purposeful but challenging.',
    '5-4': 'The Balancing Act – Balanced, dynamic, adaptable.',
    '4-5': 'Shared Exploration – Flexible, non-traditional.',
    '3-6': 'Amplification – Thrilling or destabilizing, needs boundaries.',
    '2-7': 'Influence Relationship – Unpredictable, spiritually catalytic.',
    '1-8': 'No Shared Definition – Held by choice, not mechanics.',
    '0-9': 'No Shared Definition – Held by choice, not mechanics.',
};

export function ConnectionApp() {
    const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
    const [selectedA, setSelectedA] = useState<number | null>(null);
    const [selectedB, setSelectedB] = useState<number | null>(null);
    const [chartA, setChartA] = useState<ChartData | null>(null);
    const [chartB, setChartB] = useState<ChartData | null>(null);
    const [loadingA, setLoadingA] = useState(false);
    const [loadingB, setLoadingB] = useState(false);
    const [compositeData, setCompositeData] = useState<ChartData | null>(null);
    const [connectionAnalysis, setConnectionAnalysis] = useState<ConnectionAnalysis | null>(null);
    const [theme, setTheme] = useState<AppTheme | undefined>(undefined);
    const [showResults, setShowResults] = useState(false);

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

    // When selection changes, load the chart data (recalculate if not cached)
    useEffect(() => {
        const loadChartA = async () => {
            if (selectedA === null) {
                setChartA(null);
                return;
            }
            const chart = savedCharts.find(c => c.id === selectedA);
            if (!chart) {
                setChartA(null);
                return;
            }
            if (chart.chartData) {
                setChartA(chart.chartData);
            } else {
                // Recalculate if chartData wasn't saved
                setLoadingA(true);
                try {
                    const dataObj = await ephemerisService.getChartData(chart.input);
                    setChartA(dataObj);
                } catch (e) {
                    console.error('Error loading chart A:', e);
                    setChartA(null);
                } finally {
                    setLoadingA(false);
                }
            }
        };
        loadChartA();
    }, [selectedA, savedCharts]);

    useEffect(() => {
        const loadChartB = async () => {
            if (selectedB === null) {
                setChartB(null);
                return;
            }
            const chart = savedCharts.find(c => c.id === selectedB);
            if (!chart) {
                setChartB(null);
                return;
            }
            if (chart.chartData) {
                setChartB(chart.chartData);
            } else {
                // Recalculate if chartData wasn't saved
                setLoadingB(true);
                try {
                    const dataObj = await ephemerisService.getChartData(chart.input);
                    setChartB(dataObj);
                } catch (e) {
                    console.error('Error loading chart B:', e);
                    setChartB(null);
                } finally {
                    setLoadingB(false);
                }
            }
        };
        loadChartB();
    }, [selectedB, savedCharts]);

    const handleGenerate = () => {
        if (!chartA || !chartB) return;

        // Run connection analysis - this now properly merges gates and finds composite channels
        const analysis = ConnectionLogic.classifyChannels(chartA, chartB);
        setConnectionAnalysis(analysis);

        // Merge activations (for display purposes, combine both)
        const compositeBirthActivations: Record<string, Activation> = {};
        Object.entries(chartA.birthActivations).forEach(([k, v]) => {
            compositeBirthActivations[`A_${k}`] = v;
        });
        Object.entries(chartB.birthActivations).forEach(([k, v]) => {
            compositeBirthActivations[`B_${k}`] = v;
        });

        // Merge design activations
        const compositeDesignActivations: Record<string, Activation> = {};
        Object.entries(chartA.designActivations).forEach(([k, v]) => {
            compositeDesignActivations[`A_${k}`] = v;
        });
        Object.entries(chartB.designActivations).forEach(([k, v]) => {
            compositeDesignActivations[`B_${k}`] = v;
        });

        // Use the analysis results for gates, channels, and centers
        const composite: ChartData = {
            birthActivations: compositeBirthActivations,
            designActivations: compositeDesignActivations,
            activeGates: analysis.compositeGates,           // All gates from both people
            activeChannels: analysis.compositeChannels,     // All complete channels in composite
            definedCenters: analysis.compositeCenters.definedCenters,
            type: chartA.type, // Not meaningful for composite
            authority: chartA.authority,
            profile: chartA.profile,
            variables: chartA.variables,
            definition: `Composite (${analysis.compositeCenters.code})`,
            incarnationCross: '',
            modality: '',
        };

        setCompositeData(composite);
        setShowResults(true);
    };

    const handleReset = () => {
        setShowResults(false);
        setCompositeData(null);
        setConnectionAnalysis(null);
    };

    const getChartName = (id: number | null) => {
        if (id === null) return 'Not selected';
        const chart = savedCharts.find(c => c.id === id);
        return chart?.name || 'Unknown';
    };

    // Render selection form
    if (!showResults) {
        return (
            <div className="ahd-connection-app" style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: theme?.fontFamily }}>
                <h1 style={{ textAlign: 'center', marginBottom: '1.5em' }}>Connection Chart</h1>

                {savedCharts.length < 2 ? (
                    <div style={{ textAlign: 'center', padding: '2em', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                        <p style={{ margin: 0, color: '#92400e' }}>
                            You need at least 2 saved birth charts to create a connection chart.
                        </p>
                        <p style={{ margin: '0.5em 0 0', color: '#92400e', fontSize: '0.9em' }}>
                            Go to the Birth Chart page and save some charts first.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2em' }}>
                        {/* Person A Selection */}
                        <div style={{ padding: '1.5em', backgroundColor: theme?.formBgColor || '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ margin: '0 0 1em', color: theme?.textColor || '#1f2937' }}>Person A</h3>
                            <select
                                value={selectedA ?? ''}
                                onChange={e => setSelectedA(e.target.value ? Number(e.target.value) : null)}
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
                                    <option key={c.id} value={c.id} disabled={c.id === selectedB}>
                                        {c.name} ({c.input.date})
                                    </option>
                                ))}
                            </select>
                            {chartA && (
                                <div style={{ marginTop: '1em' }}>
                                    <Bodygraph data={chartA} theme={theme} mini />
                                </div>
                            )}
                        </div>

                        {/* Person B Selection */}
                        <div style={{ padding: '1.5em', backgroundColor: theme?.formBgColor || '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            <h3 style={{ margin: '0 0 1em', color: theme?.textColor || '#1f2937' }}>Person B</h3>
                            <select
                                value={selectedB ?? ''}
                                onChange={e => setSelectedB(e.target.value ? Number(e.target.value) : null)}
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
                                    <option key={c.id} value={c.id} disabled={c.id === selectedA}>
                                        {c.name} ({c.input.date})
                                    </option>
                                ))}
                            </select>
                            {chartB && (
                                <div style={{ marginTop: '1em' }}>
                                    <Bodygraph data={chartB} theme={theme} mini />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '2em' }}>
                    {(loadingA || loadingB) && (
                        <p style={{ marginBottom: '1em', color: '#6b7280' }}>Loading chart data...</p>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={!chartA || !chartB || loadingA || loadingB}
                        style={{
                            padding: '0.75em 2em',
                            backgroundColor: (!chartA || !chartB || loadingA || loadingB) ? '#9ca3af' : (theme?.buttonBgColor || '#10b981'),
                            color: theme?.buttonTextColor || '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1em',
                            fontWeight: 600,
                            cursor: (!chartA || !chartB || loadingA || loadingB) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {(loadingA || loadingB) ? 'Loading...' : 'Generate Connection Chart'}
                    </button>
                    {selectedA && selectedB && !chartA && !chartB && !loadingA && !loadingB && (
                        <p style={{ marginTop: '1em', color: '#dc2626', fontSize: '0.9em' }}>
                            Could not load chart data. Try re-saving the charts from the Birth Chart page.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Render results: 3-bodygraph layout
    const themeCode = connectionAnalysis?.compositeCenters.code || '';
    const themeDescription = CONNECTION_THEME_DESCRIPTIONS[themeCode] || '';

    return (
        <div className="ahd-connection-results" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: theme?.fontFamily }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5em' }}>
                <div>
                    <h2 style={{ margin: 0, color: theme?.textColor || '#1f2937' }}>
                        Connection: {getChartName(selectedA)} + {getChartName(selectedB)}
                    </h2>
                    <p style={{ margin: '0.25em 0 0', color: '#6b7280', fontSize: '0.9em' }}>
                        Theme: <strong>{themeCode}</strong> – {themeDescription}
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
                    New Connection
                </button>
            </div>

            {/* 3-column layout: Person A | Composite | Person B */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '1.5em', alignItems: 'flex-start' }}>
                {/* Person A */}
                <div style={{ backgroundColor: '#fff', padding: '1em', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: '0 0 0.75em', fontSize: '1em', color: theme?.textColor || '#1f2937' }}>
                        {getChartName(selectedA)}
                    </h3>
                    {chartA && (
                        <>
                            <Bodygraph data={chartA} theme={theme} mini />
                            <div style={{ marginTop: '1em' }}>
                                <PlanetPanel
                                    activations={chartA.birthActivations}
                                    side="personality"
                                    color={theme?.personalityColor || '#000'}
                                    textColor={theme?.textColor || '#111827'}
                                    fontFamily={theme?.fontFamily}
                                />
                                <PlanetPanel
                                    activations={chartA.designActivations}
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
                        Composite Chart
                    </h3>
                    {compositeData && connectionAnalysis && (
                        <>
                            <Bodygraph data={compositeData} connectionAnalysis={connectionAnalysis} theme={theme} />

                            {/* Connection Legend */}
                            <div style={{ marginTop: '1em', padding: '0.75em', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '0.85em' }}>
                                <div style={{ fontWeight: 600, marginBottom: '0.5em' }}>
                                    Composite: {connectionAnalysis.compositeChannels.length} channels, {connectionAnalysis.compositeCenters.definedCenters.size} defined centers
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75em', marginBottom: '0.5em' }}>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionElectromagneticColor || '#8b5cf6', borderRadius: 2, marginRight: 4 }}></span> Electromagnetic ({connectionAnalysis.electromagnetic.length})</span>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionCompromiseColor || '#f59e0b', borderRadius: 2, marginRight: 4 }}></span> Compromise ({connectionAnalysis.compromise.length})</span>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionCompanionColor || '#3b82f6', borderRadius: 2, marginRight: 4 }}></span> Companion ({connectionAnalysis.companion.length})</span>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: theme?.connectionDominanceColor || '#10b981', borderRadius: 2, marginRight: 4 }}></span> Dominance ({connectionAnalysis.dominance.length})</span>
                                    <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#9ca3af', borderRadius: 2, marginRight: 4 }}></span> Hanging Gate</span>
                                </div>
                                {connectionAnalysis.compositeCenters.definedByComposite.size > 0 && (
                                    <div style={{ color: '#059669', fontSize: '0.9em' }}>
                                        ✨ New centers defined together: {[...connectionAnalysis.compositeCenters.definedByComposite].join(', ')}
                                    </div>
                                )}
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
                                        <span style={{ marginLeft: '0.5em' }}>{connectionAnalysis.compromise.map(c => `${c.id} (${c.fromPerson} dominates)`).join(', ')}</span>
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
                                        <span style={{ marginLeft: '0.5em' }}>{connectionAnalysis.dominance.map(c => `${c.id} (${c.fromPerson})`).join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Person B */}
                <div style={{ backgroundColor: '#fff', padding: '1em', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: '0 0 0.75em', fontSize: '1em', color: theme?.textColor || '#1f2937' }}>
                        {getChartName(selectedB)}
                    </h3>
                    {chartB && (
                        <>
                            <Bodygraph data={chartB} theme={theme} mini />
                            <div style={{ marginTop: '1em' }}>
                                <PlanetPanel
                                    activations={chartB.birthActivations}
                                    side="personality"
                                    color={theme?.personalityColor || '#000'}
                                    textColor={theme?.textColor || '#111827'}
                                    fontFamily={theme?.fontFamily}
                                />
                                <PlanetPanel
                                    activations={chartB.designActivations}
                                    side="design"
                                    color={theme?.designColor || '#ff0000'}
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
