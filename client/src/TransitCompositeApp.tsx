import { useState, useEffect, useRef } from 'react';
import { Bodygraph } from './components/Bodygraph';
import { ConnectionPlanetPanel } from './components/ConnectionPlanetPanel';
import { ChartData, Activation, HumanDesignLogic } from './services/HumanDesignLogic';
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
    const exportRef = useRef<HTMLDivElement>(null);

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
            link.download = `transit-${getChartName(selectedBirth)}-${transitDate}.png`;
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

            const finalHeight = Math.min(imgHeight, pageHeight - margin * 2);
            const finalWidth = (finalHeight / imgHeight) * imgWidth;

            pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
            pdf.save(`transit-${getChartName(selectedBirth)}-${transitDate}.pdf`);
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

    // Render results
    const themeCode = connectionAnalysis?.compositeCenters.code || '';
    const birthChartInfo = savedCharts.find(c => c.id === selectedBirth);

    return (
        <div className="ahd-transit-composite-results" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: theme?.fontFamily }}>
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
                    New Composite
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
                        Transit + Birth Composite
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '12px' }}>
                        {getChartName(selectedBirth)} • Transit: {transitDate} {transitTime} UTC • Theme: <strong>{themeCode}</strong>
                    </p>
                </div>

                {/* Main layout: Birth info | Design Panel | Composite | Personality Panel | Transit info */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 160px 1fr 160px 1fr', 
                    gap: '8px', 
                    alignItems: 'flex-start'
                }}>
                    
                    {/* Birth Chart Info (left) */}
                    <div style={{ fontSize: '9px', color: 'theme?.textColor' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '11px', color: 'theme?.textColor' }}>
                            {getChartName(selectedBirth)}
                        </h3>
                        {birthChartInfo && (
                            <div style={{ lineHeight: 1.3 }}>
                                <div>Birth: {birthChartInfo.input.date}</div>
                                <div>Time: {birthChartInfo.input.time}</div>
                                <div style={{ wordBreak: 'break-word' }}>{birthChartInfo.input.location}</div>
                                {birthChart && (
                                    <>
                                        <div style={{ marginTop: '3px' }}>Type: {birthChart.type}</div>
                                        <div>Profile: {birthChart.profile}</div>
                                        <div>Authority: {birthChart.authority}</div>
                                        <div>Definition: {birthChart.definition}</div>
                                    </>
                                )}
                            </div>
                        )}
                        {birthChart && (
                            <div style={{ marginTop: '6px', maxWidth: '80px', transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                                <Bodygraph data={birthChart} theme={theme} mini />
                            </div>
                        )}
                    </div>

                    {/* Design Panel - Birth design only (no transit design gates) */}
                    {birthChart && (
                        <ConnectionPlanetPanel
                            activationsA={birthChart.designActivations}
                            activationsB={{} as Record<string, Activation>}
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
                            <div style={{ maxWidth: '280px', margin: '0 auto' }}>
                                <Bodygraph data={compositeData} connectionAnalysis={connectionAnalysis} theme={theme} />
                            </div>
                        )}
                    </div>

                    {/* Personality Panel - Birth + Transit personality activations */}
                    {birthChart && transitChart && (
                        <ConnectionPlanetPanel
                            activationsA={birthChart.birthActivations}
                            activationsB={transitChart.birthActivations}
                            side="personality"
                            colorA={theme?.personalityColor || '#000'}
                            colorB={theme?.personalityColor || '#000'}
                            fontFamily={theme?.fontFamily}
                        />
                    )}

                    {/* Transit Info (right) */}
                    <div style={{ fontSize: '9px', textAlign:'right', color: theme?.textColor }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '11px', color: 'theme?.textColor' }}>
                            Transit
                        </h3>
                        <div style={{ lineHeight: 1.3 }}>
                            <div>Date: {transitDate}</div>
                            <div>Time: {transitTime} UTC</div>
                            <div>Location: 0° lat, 0° lon</div>
                        </div>
                        {transitChart && (
                            <div style={{ marginTop: '6px', maxWidth: '80px', transform: 'scale(0.7)', transformOrigin: 'top right' }}>
                                <Bodygraph data={transitChart} theme={theme} mini />
                            </div>
                        )}
                    </div>
                </div>

                {/* Transit Activation Section - Compact */}
                {connectionAnalysis && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                        <h3 style={{ margin: '0 0 6px', textAlign: 'center' }}>What the Transit Activates</h3>
                        
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
                                    <div key={ch.id} style={{ marginLeft: '12px' }}>{ch.id}</div>
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
                                    <div key={ch.id} style={{ marginLeft: '12px' }}>{ch.id}</div>
                                ))}
                            </div>
                        </div>

                        {connectionAnalysis.compositeCenters.definedByComposite.size > 0 && (
                            <div style={{ marginTop: '6px', textAlign: 'center', color: '#059669' }}>
                                Centers activated by transit: {[...connectionAnalysis.compositeCenters.definedByComposite].join(', ')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
