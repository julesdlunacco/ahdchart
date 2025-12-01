import { useState, useEffect, useRef } from 'react';
import { Bodygraph } from './components/Bodygraph';
import { ConnectionPlanetPanel } from './components/ConnectionPlanetPanel';
import { ChartData, Activation } from './services/HumanDesignLogic';
import { EphemerisService } from './services/EphemerisService';
import { ConnectionLogic, ConnectionAnalysis } from './services/ConnectionLogic';
import { AppTheme } from './types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
    const exportRef = useRef<HTMLDivElement>(null);

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

    const handleExportPng = async () => {
        if (!exportRef.current) return;
        try {
            const canvas = await html2canvas(exportRef.current, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `connection-${getChartName(selectedA)}-${getChartName(selectedB)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Error exporting PNG', e);
        }
    };

    const handleExportPdf = async () => {
        if (!exportRef.current) return;
        try {
            const canvas = await html2canvas(exportRef.current, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 30;
            const imgWidth = pageWidth - margin * 2;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // If image is taller than page, scale down
            const finalHeight = Math.min(imgHeight, pageHeight - margin * 2);
            const finalWidth = (finalHeight / imgHeight) * imgWidth;

            pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
            pdf.save(`connection-${getChartName(selectedA)}-${getChartName(selectedB)}.pdf`);
        } catch (e) {
            console.error('Error exporting PDF', e);
        }
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

    // Render results
    const themeCode = connectionAnalysis?.compositeCenters.code || '';
    const themeDescription = CONNECTION_THEME_DESCRIPTIONS[themeCode] || '';

    // Get chart info for display
    const chartAInfo = savedCharts.find(c => c.id === selectedA);
    const chartBInfo = savedCharts.find(c => c.id === selectedB);

    return (
        <div className="ahd-connection-results" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: theme?.fontFamily }}>
            {/* Action buttons - hidden in export */}
            <div className="no-export" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75em', marginBottom: '1em' }}>
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
                <button
                    onClick={handleExportPng}
                    style={{
                        padding: '0.5em 1em',
                        backgroundColor: '#1f2937',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    Export PNG
                </button>
                <button
                    onClick={handleExportPdf}
                    style={{
                        padding: '0.5em 1em',
                        backgroundColor: '#1f2937',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    Export PDF
                </button>
            </div>

            {/* Exportable content - landscape layout, width driven by content so nothing is clipped */}
            <div 
                ref={exportRef} 
                style={{ 
                    backgroundColor: '#fff', 
                    padding: '12px 16px', 
                    borderRadius: '8px',
                    minHeight: '750px',
                    boxSizing: 'border-box',
                    margin: '0 auto',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <h2 style={{ margin: 0, color: '#c026d3', fontSize: '18px', fontWeight: 600 }}>
                        Connection Chart
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '12px' }}>
                        Theme: <strong>{themeCode}</strong> – {themeDescription}
                    </p>
                </div>

                {/* Main layout: Person A info | Design Panel | Composite | Personality Panel | Person B info */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 160px 1fr 160px 1fr', 
                    gap: '8px', 
                    alignItems: 'flex-start'
                }}>
                    
                    {/* Person A Info (left) */}
                    <div style={{ fontSize: '9px', color: 'theme?.textColor' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '11px', color: 'theme?.textColor' }}>
                            {getChartName(selectedA)}
                        </h3>
                        {chartAInfo && (
                            <div style={{ lineHeight: 1.3 }}>
                                <div>Birth: {chartAInfo.input.date}</div>
                                <div>Time: {chartAInfo.input.time}</div>
                                <div style={{ wordBreak: 'break-word' }}>{chartAInfo.input.location}</div>
                                {chartA && (
                                    <>
                                        <div style={{ marginTop: '3px' }}>Type: {chartA.type}</div>
                                        <div>Profile: {chartA.profile}</div>
                                        <div>Authority: {chartA.authority}</div>
                                        <div>Definition: {chartA.definition}</div>
                                    </>
                                )}
                            </div>
                        )}
                        {chartA && (
                            <div style={{ marginTop: '6px', maxWidth: '80px', transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                                <Bodygraph data={chartA} theme={theme} mini />
                            </div>
                        )}
                    </div>

                    {/* Design Panel - Both people's design activations */}
                    {chartA && chartB && (
                        <ConnectionPlanetPanel
                            activationsA={chartA.designActivations}
                            activationsB={chartB.designActivations}
                            side="design"
                            colorA={theme?.designColor || '#ff0000'}
                            colorB={theme?.designColor || '#ff0000'}
                            fontFamily={theme?.fontFamily}
                        />
                    )}

                    {/* Composite Bodygraph (center) */}
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '11px', color: theme?.textColor || '#1f2937' }}>
                            Composite
                        </h3>
                        {compositeData && connectionAnalysis && (
                            <div style={{ maxWidth: '320px', margin: '0 auto' }}>
                                <Bodygraph data={compositeData} connectionAnalysis={connectionAnalysis} theme={theme} />
                            </div>
                        )}
                    </div>

                    {/* Personality Panel - Both people's personality activations */}
                    {chartA && chartB && (
                        <ConnectionPlanetPanel
                            activationsA={chartA.birthActivations}
                            activationsB={chartB.birthActivations}
                            side="personality"
                            colorA={theme?.personalityColor || '#000'}
                            colorB={theme?.personalityColor || '#000'}
                            fontFamily={theme?.fontFamily}
                        />
                    )}

                    {/* Person B Info (right) */}
                    <div style={{ fontSize: '9px', textAlign: 'right', color: 'theme?.textColor' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '11px', color: 'theme?.textColor' }}>
                            {getChartName(selectedB)}
                        </h3>
                        {chartBInfo && (
                            <div style={{ lineHeight: 1.3 }}>
                                <div>Birth: {chartBInfo.input.date}</div>
                                <div>Time: {chartBInfo.input.time}</div>
                                <div style={{ wordBreak: 'break-word' }}>{chartBInfo.input.location}</div>
                                {chartB && (
                                    <>
                                        <div style={{ marginTop: '3px' }}>Type: {chartB.type}</div>
                                        <div>Profile: {chartB.profile}</div>
                                        <div>Authority: {chartB.authority}</div>
                                        <div>Definition: {chartB.definition}</div>
                                    </>
                                )}
                            </div>
                        )}
                        {chartB && (
                            <div style={{ marginTop: '6px', maxWidth: '80px', transform: 'scale(0.7)', transformOrigin: 'top right' }}>
                                <Bodygraph data={chartB} theme={theme} mini />
                            </div>
                        )}
                    </div>
                </div>

                {/* Connection Channels Section - Compact */}
                {connectionAnalysis && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                        <h3 style={{ margin: '0 0 6px', textAlign: 'center' }}>Connection Channels</h3>
                        
                        {/* Theme info */}
                        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                            <strong>Theme: {themeCode}</strong>
                            <span style={{ marginLeft: '6px', color: '#6b7280' }}>
                                ({connectionAnalysis.compositeCenters.definedCenters.size} defined, {connectionAnalysis.compositeCenters.openCenters.size} open)
                            </span>
                        </div>

                        {/* Channel type columns */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {/* Electromagnetic */}
                            <div>
                                <div style={{ fontWeight: 600, color: theme?.connectionElectromagneticColor || '#8b5cf6', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: theme?.connectionElectromagneticColor || '#8b5cf6', borderRadius: 1 }}></span>
                                    Electromagnetic ({connectionAnalysis.electromagnetic.length})
                                </div>
                                {connectionAnalysis.electromagnetic.map(ch => (
                                    <div key={ch.id} style={{ marginLeft: '12px' }}>{ch.id}</div>
                                ))}
                            </div>

                            {/* Compromise */}
                            <div>
                                <div style={{ fontWeight: 600, color: theme?.connectionCompromiseColor || '#f59e0b', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: theme?.connectionCompromiseColor || '#f59e0b', borderRadius: 1 }}></span>
                                    Compromise ({connectionAnalysis.compromise.length})
                                </div>
                                {connectionAnalysis.compromise.map(ch => (
                                    <div key={ch.id} style={{ marginLeft: '12px' }}>{ch.id} ({ch.fromPerson})</div>
                                ))}
                            </div>

                            {/* Companion */}
                            <div>
                                <div style={{ fontWeight: 600, color: theme?.connectionCompanionColor || '#3b82f6', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: theme?.connectionCompanionColor || '#3b82f6', borderRadius: 1 }}></span>
                                    Companion ({connectionAnalysis.companion.length})
                                </div>
                                {connectionAnalysis.companion.map(ch => (
                                    <div key={ch.id} style={{ marginLeft: '12px' }}>{ch.id}</div>
                                ))}
                            </div>

                            {/* Dominance */}
                            <div>
                                <div style={{ fontWeight: 600, color: theme?.connectionDominanceColor || '#10b981', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: theme?.connectionDominanceColor || '#10b981', borderRadius: 1 }}></span>
                                    Dominance ({connectionAnalysis.dominance.length})
                                </div>
                                {connectionAnalysis.dominance.map(ch => (
                                    <div key={ch.id} style={{ marginLeft: '12px' }}>{ch.id} ({ch.fromPerson})</div>
                                ))}
                            </div>
                        </div>

                        {connectionAnalysis.compositeCenters.definedByComposite.size > 0 && (
                            <div style={{ marginTop: '6px', textAlign: 'center', color: '#059669' }}>
                                New centers defined together: {[...connectionAnalysis.compositeCenters.definedByComposite].join(', ')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
