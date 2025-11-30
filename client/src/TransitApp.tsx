import { useMemo, useState, useEffect, useRef } from 'react';
import { EphemerisService } from './services/EphemerisService';
import { Bodygraph } from './components/Bodygraph';
import { PlanetPanel } from './components/PlanetPanel';
import { ChartData, Activation, HumanDesignLogic } from './services/HumanDesignLogic';
import { Center } from './services/HumanDesignDefinitions';
import { AppTheme } from './types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Separate Ephemeris service instance is fine; underlying WASM init is idempotent.
const ephemerisService = new EphemerisService('assets/ephe');

// Helper functions specific to transit reporting
const getZodiacSign = (longitude: number): string => {
    const signs = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    let index = Math.floor(longitude / 30);
    if (index < 0 || index > 11) {
        index = ((index % 12) + 12) % 12;
    }
    return signs[index];
};

const formatDegrees = (decimalDegrees: number): string => {
    const inSignDegrees = decimalDegrees % 30;
    let degrees = Math.floor(inSignDegrees);

    const totalMinutes = (inSignDegrees - degrees) * 60;
    let minutes = Math.floor(totalMinutes);
    let seconds = Math.round((totalMinutes - minutes) * 60);

    if (seconds === 60) {
        seconds = 0;
        minutes++;
    }
    if (minutes === 60) {
        minutes = 0;
        degrees++;
    }

    return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds
        .toString()
        .padStart(2, '0')}"`;
};

const getModality = (longitude: number): string => {
    const index = Math.floor(longitude / 30);
    const modalities = ['Cardinal', 'Fixed', 'Mutable'];
    return modalities[index % 3];
};

const buildTransitReport = (
    birthActivations: Record<string, Activation>,
    chartData: ChartData,
    crossPointsSection: string,
    themeName: string | undefined,
    meta: {
        localDateTime: string;
        location: string;
        lat: number;
        lng: number;
    }
): string => {
    let output = 'Human Design Transit Analysis\n-------------------------------\n';
    if (themeName) {
        output += `Theme: ${themeName}\n`;
    }
    output += `Date/Time (Local): ${meta.localDateTime}\n`;
    output += `Location: ${meta.location || 'Unknown'}\n`;
    output += `Coordinates: ${meta.lat.toFixed(2)}°, ${meta.lng.toFixed(2)}°\n\n`;

    // Planetary positions (personality/transit side only)
    const order = [
        'Sun', 'Earth', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
        'NorthNode', 'SouthNode', 'Chiron', 'Black Moon Lilith'
    ];

    output += 'Transit Planetary Positions:\n\n';
    order.forEach(name => {
        const act = birthActivations[name];
        if (!act) return;
        const sign = getZodiacSign(act.longitude);
        const housePart = act.house ? `, House ${act.house}` : '';
        output += `${name}: ${act.gate}.${act.line}, ${sign} ${formatDegrees(
            act.longitude
        )}${housePart}\n`;
    });

    // Stelliums (personality-only, same inclusion as main report)
    const includedPlanets = [
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
        'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'
    ];

    const signCounts: Record<string, number> = {};
    includedPlanets.forEach(p => {
        const act = birthActivations[p];
        if (!act) return;
        const sign = getZodiacSign(act.longitude);
        signCounts[sign] = (signCounts[sign] || 0) + 1;
    });

    let stelliumText = '';
    Object.entries(signCounts).forEach(([sign, count]) => {
        if (count >= 3) {
            stelliumText += `Stellium in ${sign}\n`;
        }
    });

    if (stelliumText) {
        output += `\nTransit Stelliums:\n${stelliumText}`;
    }

    // Modality from the Sun only (transit does not have a design side)
    const sun = birthActivations['Sun'];
    if (sun) {
        const modality = getModality(sun.longitude);
        output += `\nTransit Modality (Sun): ${modality}\n`;
    }

    // Personality-only active channels and defined centers
    output += `\nTransit Active Channels (Personality-only):\n`;
    if (!chartData.activeChannels || chartData.activeChannels.length === 0) {
        output += 'None\n';
    } else {
        chartData.activeChannels.forEach(ch => {
            output += `Channel ${ch}\n`;
        });
    }

    output += `\nTransit Defined Centers (Personality-only):\n`;
    const centerOrder = [
        Center.Root, Center.Sacral, Center.Emotions, Center.Spleen,
        Center.Heart, Center.Self, Center.Throat, Center.Mind, Center.Crown
    ];
    const centerNameMap: Record<string, string> = {
        [Center.Root]: 'Root',
        [Center.Sacral]: 'Sacral',
        [Center.Emotions]: 'Emotions',
        [Center.Spleen]: 'Spleen',
        [Center.Heart]: 'Ego/Willpower',
        [Center.Self]: 'G-Center/Heart',
        [Center.Throat]: 'Throat',
        [Center.Mind]: 'Mind',
        [Center.Crown]: 'Crown'
    };

    centerOrder.forEach(c => {
        const status = chartData.definedCenters.has(c) ? 'Defined' : 'Undefined';
        output += `${centerNameMap[c]}: ${status}\n`;
    });

    // Cross points (Asc/MC/etc.) from personality side
    if (crossPointsSection) {
        const cleaned = crossPointsSection
            .replace('\nBirth Chart Cross Points:\n', '')
            .trimEnd();
        if (cleaned) {
            output += `\nTransit Cross Points (Personality):\n${cleaned}\n`;
        }
    }

    return output;
};

export function TransitApp() {
    const now = new Date();
    const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
    ).padStart(2, '0')}`;
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
    ).padStart(2, '0')}`;
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const [input, setInput] = useState({
        // No name for transit charts
        date: defaultDate,
        time: defaultTime,
        location: '',
        timezone: browserTz,
        latitude: '',
        longitude: ''
    });
    const [result, setResult] = useState<string | null>(null);
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(false);
    const [cityQuery, setCityQuery] = useState('');
    const [cityResults, setCityResults] = useState<
        Array<{
            city: string;
            admin_name: string;
            country: string;
            latitude: number;
            longitude: number;
        }>
    >([]);
    const [cityLoading, setCityLoading] = useState(false);
    const [tzSearch, setTzSearch] = useState(browserTz);
    const [theme, setTheme] = useState<AppTheme | undefined>(undefined);
    const [copied, setCopied] = useState(false);
    const chartExportRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (window.ahdSettings && window.ahdSettings.theme) {
            setTheme(window.ahdSettings.theme);
        }
        // Auto-generate transit on initial load
        runTransit();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const runTransit = async () => {
        setLoading(true);
        try {
            // For transits, use coordinates 0/0 and UTC.
            // Date/time come from the form if available; otherwise fall back to current UTC.
            let dateStr = input.date;
            let timeStr = input.time;

            if (!dateStr || !timeStr) {
                const nowUtc = new Date();
                const yyyy = nowUtc.getUTCFullYear();
                const mm = String(nowUtc.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(nowUtc.getUTCDate()).padStart(2, '0');
                const HH = String(nowUtc.getUTCHours()).padStart(2, '0');
                const MM = String(nowUtc.getUTCMinutes()).padStart(2, '0');

                dateStr = `${yyyy}-${mm}-${dd}`;
                timeStr = `${HH}:${MM}`;
            }

            const payload = {
                name: 'Transit',
                date: dateStr,
                time: timeStr,
                location: 'Transit (UTC, 0° lat, 0° lon)',
                timezone: 'UTC',
                latitude: '0',
                longitude: '0'
            };

            const [dataObj, fullReport] = await Promise.all([
                ephemerisService.getChartData(payload),
                ephemerisService.calculateChart(payload)
            ]);

            // Build a minimal designActivations map cloned from personality
            // so determineChartProperties has the fields it expects (Sun, NorthNode, etc.)
            const designClone: Record<string, Activation> = {};
            ['Sun', 'NorthNode'].forEach(name => {
                const act = dataObj.birthActivations[name];
                if (act) {
                    designClone[name] = { ...act };
                }
            });

            // Recompute chart properties using personality activations, with designClone
            // used only to satisfy profile/variable calculations internally.
            const personalityOnlyChart = HumanDesignLogic.determineChartProperties(
                dataObj.birthActivations,
                designClone
            );

            const meta = {
                localDateTime: `${dateStr} ${timeStr} (UTC)`,
                location: payload.location,
                lat: 0,
                lng: 0
            };

            // Update display state to reflect the actual transit calculation context
            setInput({
                date: dateStr,
                time: timeStr,
                location: payload.location,
                timezone: payload.timezone,
                latitude: '',
                longitude: ''
            });

            // Extract the Birth Chart Cross Points section from the full report
            let crossPointsSection = '';
            const startMarker = '\nBirth Chart Cross Points:\n';
            const endMarker = '\nDesign Chart Planetary Positions:';
            const startIdx = fullReport.indexOf(startMarker);
            if (startIdx !== -1) {
                const endIdx = fullReport.indexOf(endMarker, startIdx);
                crossPointsSection =
                    endIdx !== -1
                        ? fullReport.substring(startIdx, endIdx)
                        : fullReport.substring(startIdx);
            }

            const textReport = buildTransitReport(
                dataObj.birthActivations,
                personalityOnlyChart,
                crossPointsSection,
                undefined,
                meta
            );

            setResult(textReport);

            const taggedData = {
                ...(personalityOnlyChart as any),
                birthActivations: dataObj.birthActivations,
                designActivations: {},
                isTransit: true,
                // Do not show variables/quad arrows for transit
                variables: undefined
            } as any;

            setChartData(taggedData as ChartData);
        } catch (error) {
            console.error(error);
            setResult('Error calculating transit chart. Check console.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runTransit();
    };

    const handleCopyReport = async () => {
        if (!result) return;

        const copyToClipboard = async (text: string) => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                    throw err;
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        };

        try {
            await copyToClipboard(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Error copying report', e);
            alert('Failed to copy report. Please manually select and copy the text.');
        }
    };

    const handleExportPng = async () => {
        if (!chartExportRef.current) return;
        try {
            const canvas = await html2canvas(chartExportRef.current, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `transit-chart.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Error exporting PNG', e);
        }
    };

    const handleExportPdf = async () => {
        if (!chartExportRef.current) return;
        try {
            const canvas = await html2canvas(chartExportRef.current, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 40;
            const imgWidth = pageWidth - margin * 2;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);

            if (result) {
                pdf.addPage();
                pdf.setFontSize(11);
                const textMargin = 40;
                const textWidth = pageWidth - textMargin * 2;
                const lines = pdf.splitTextToSize(result, textWidth) as string[];
                const lineHeight = 14;
                let cursorY = textMargin;

                lines.forEach(line => {
                    if (cursorY > pageHeight - textMargin) {
                        pdf.addPage();
                        cursorY = textMargin;
                    }
                    pdf.text(line, textMargin, cursorY);
                    cursorY += lineHeight;
                });
            }

            pdf.save('transit-chart.pdf');
        } catch (e) {
            console.error('Error exporting PDF', e);
        }
    };

    const handleDownloadReport = (extension: 'txt' | 'md') => {
        if (!result) return;
        const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transit-report.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleCitySearch = async (value: string) => {
        setCityQuery(value);
        if (value.trim().length < 2) {
            setCityResults([]);
            return;
        }
        try {
            setCityLoading(true);
            const params = new URLSearchParams({ q: value.trim() });
            const res = await fetch(`/wp-json/ahd/v1/cities?${params.toString()}`);
            if (!res.ok) throw new Error('City search failed');
            const data = await res.json();
            setCityResults(data || []);
        } catch (err) {
            console.error(err);
            setCityResults([]);
        } finally {
            setCityLoading(false);
        }
    };

    const handleCitySelect = (city: {
        city: string;
        admin_name: string;
        country: string;
        latitude: number;
        longitude: number;
    }) => {
        setInput({
            ...input,
            location: `${city.city}, ${city.country}`,
            latitude: String(city.latitude),
            longitude: String(city.longitude)
        });
        setCityQuery(`${city.city}, ${city.country}`);
        setCityResults([]);
    };

    const timezoneOptions = useMemo(
        () => [
            'UTC',
            'America/New_York',
            'America/Chicago',
            'America/Denver',
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Paris',
            'Europe/Berlin',
            'Asia/Tokyo',
            'Asia/Shanghai',
            'Australia/Sydney'
        ],
        []
    );

    const filteredTimezones = useMemo(() => {
        const search = tzSearch.trim().toLowerCase();
        if (!search) return timezoneOptions;
        return timezoneOptions.filter(tz => tz.toLowerCase().includes(search));
    }, [tzSearch, timezoneOptions]);

    return (
        <div
            className="ahd-container"
            style={{
                width: '100%',
                boxSizing: 'border-box',
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '20px',
                fontFamily: theme?.fontFamily,
                fontSize: `calc(16px * ${theme?.fontSizeScale || 1})`
            }}
        >
            <h1 style={{ textAlign: 'center', marginBottom: '1.5em' }}>Human Design Transit Chart</h1>

            {!chartData ? (
                <form
                    onSubmit={handleSubmit}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1em',
                        width: '100%',
                        maxWidth: '600px',
                        margin: '0 auto',
                        padding: '1.25em',
                        borderRadius: '0.75em',
                        backgroundColor: theme?.formBgColor || '#ffffff',
                        border: '1px solid #e5e7eb'
                    }}
                >
                    <div style={{ display: 'flex', gap: '1em' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.5em' }}>Date</label>
                            <input
                                type="date"
                                value={input.date}
                                onChange={e => setInput({ ...input, date: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.5em 0.75em',
                                    borderRadius: '0.375em',
                                    border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                    backgroundColor: theme?.inputBgColor || '#ffffff'
                                }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.5em' }}>Time</label>
                            <input
                                type="time"
                                value={input.time}
                                onChange={e => setInput({ ...input, time: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '0.5em 0.75em',
                                    borderRadius: '0.375em',
                                    border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                    backgroundColor: theme?.inputBgColor || '#ffffff'
                                }}
                            />
                        </div>
                    </div>

                    {/* Hide location and timezone inputs for transit charts */}
                    <div style={{ display: 'none' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5em' }}>City</label>
                            <input
                                type="text"
                                value={cityQuery}
                                onChange={e => handleCitySearch(e.target.value)}
                                placeholder="Start typing a city name"
                                style={{
                                    width: '100%',
                                    padding: '0.5em 0.75em',
                                    borderRadius: '0.375em',
                                    border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                    backgroundColor: theme?.inputBgColor || '#ffffff'
                                }}
                            />
                            {cityLoading && <div style={{ fontSize: '0.85em' }}>Searching…</div>}
                            {cityResults.length > 0 && (
                                <ul
                                    style={{
                                        listStyle: 'none',
                                        padding: 0,
                                        margin: '0.5em 0',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        border: '1px solid #ddd',
                                        borderRadius: 4
                                    }}
                                >
                                    {cityResults.map((c, idx) => (
                                        <li
                                            key={`${c.city}-${c.country}-${idx}`}
                                            onClick={() => handleCitySelect(c)}
                                            style={{
                                                padding: '0.4em 0.6em',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #eee'
                                            }}
                                        >
                                            {c.city}, {c.admin_name}, {c.country}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1em' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5em' }}>Latitude</label>
                                <input
                                    type="text"
                                    value={input.latitude}
                                    onChange={e => setInput({ ...input, latitude: e.target.value })}
                                    placeholder="e.g. 34.0522"
                                    style={{
                                        width: '100%',
                                        padding: '0.5em 0.75em',
                                        borderRadius: '0.375em',
                                        border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                        backgroundColor: theme?.inputBgColor || '#ffffff'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5em' }}>Longitude</label>
                                <input
                                    type="text"
                                    value={input.longitude}
                                    onChange={e => setInput({ ...input, longitude: e.target.value })}
                                    placeholder="e.g. -118.2437"
                                    style={{
                                        width: '100%',
                                        padding: '0.5em 0.75em',
                                        borderRadius: '0.375em',
                                        border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                        backgroundColor: theme?.inputBgColor || '#ffffff'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5em' }}>Timezone</label>
                            <input
                                type="text"
                                value={tzSearch}
                                onChange={e => setTzSearch(e.target.value)}
                                placeholder="Search timezone (e.g. America/Los_Angeles)"
                                style={{
                                    width: '100%',
                                    padding: '0.5em 0.75em',
                                    borderRadius: '0.375em',
                                    border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                                    backgroundColor: theme?.inputBgColor || '#ffffff',
                                    marginBottom: '0.5em'
                                }}
                            />
                            <ul
                                style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    border: '1px solid #ddd',
                                    borderRadius: 4
                                }}
                            >
                                {filteredTimezones.map(tz => (
                                    <li
                                        key={tz}
                                        onClick={() => {
                                            setInput({ ...input, timezone: tz });
                                            setTzSearch(tz);
                                        }}
                                        style={{
                                            padding: '0.4em 0.6em',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #eee',
                                            background: input.timezone === tz ? '#e5e7eb' : 'white'
                                        }}
                                    >
                                        {tz}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '0.6em 1.2em',
                            backgroundColor: theme?.buttonBgColor || '#10b981',
                            color: theme?.buttonTextColor || 'white',
                            border: 'none',
                            borderRadius: '0.5em',
                            cursor: 'pointer',
                            fontWeight: 500,
                            marginTop: '0.5em'
                        }}
                    >
                        {loading ? (
                            <span
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5em'
                                }}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                    style={{ animation: 'ahd-spin 1s linear infinite' }}
                                >
                                    <style>{`@keyframes ahd-spin { 100% { transform: rotate(360deg); } }`}</style>
                                    <path
                                        d="M12 22c5.421 0 10-4.579 10-10h-2c0 4.337-3.663 8-8 8s-8-3.663-8-8c0-4.336 3.663-8 8-8V2C6.579 2 2 6.58 2 12c0 5.421 4.579 10 10 10z"
                                        fill="currentColor"
                                    />
                                </svg>
                                Calculating...
                            </span>
                        ) : (
                            'Generate Transit'
                        )}
                    </button>
                </form>
            ) : (
                <div className="ahd-results-view">
                    {/* Export region: header + chart grid */}
                    <div ref={chartExportRef}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1.5em',
                                paddingBottom: '1em',
                                borderBottom: '1px solid #e5e7eb'
                            }}
                        >
                            <div>
                                <h2
                                    style={{
                                        margin: 0,
                                        fontSize: '1.5em',
                                        fontWeight: '600',
                                        color: theme?.textColor || '#1f2937'
                                    }}
                                >
                                    Transit for {input.location || '0° lat, 0° lon (UTC)'}
                                </h2>
                                <p
                                    style={{
                                        margin: '4px 0 0',
                                        fontSize: '0.875em',
                                        color: '#6b7280'
                                    }}
                                >
                                    {input.date} {input.time} • Transit (UTC)
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
                                <button
                                    onClick={() => {
                                        setChartData(null);
                                        setResult(null);
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#6b7280',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        fontSize: '0.875em'
                                    }}
                                >
                                    New Transit
                                </button>
                                <button
                                    onClick={handleExportPng}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#1f2937',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        fontSize: '0.875em'
                                    }}
                                >
                                    Export PNG
                                </button>
                                <button
                                    onClick={handleExportPdf}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#111827',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        fontSize: '0.875em'
                                    }}
                                >
                                    Export PDF
                                </button>
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                                gap: '1.5em',
                                alignItems: 'flex-start'
                            }}
                        >
                            <div
                                style={{
                                    backgroundColor: '#ffffff',
                                    padding: '1.25em',
                                    borderRadius: '0.75em',
                                    border: '1px solid #e5e7eb'
                                }}
                            >
                                {chartData && <Bodygraph data={chartData as any} theme={theme} />}
                            </div>
                            <div
                                style={{
                                    backgroundColor: '#ffffff',
                                    padding: '1.25em',
                                    borderRadius: '0.75em',
                                    border: '1px solid #e5e7eb',
                                    maxHeight: '600px',
                                    overflowY: 'auto'
                                }}
                            >
                                {chartData && (
                                    <PlanetPanel
                                        activations={chartData.birthActivations}
                                        side="personality"
                                        color={theme?.personalityColor || '#000000'}
                                        textColor={theme?.textColor || '#111827'}
                                        fontFamily={theme?.fontFamily}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {result && (
                        <div
                            style={{
                                marginTop: '1.5em',
                                padding: '1.25em',
                                borderRadius: '0.75em',
                                border: '1px solid #e5e7eb',
                                backgroundColor: '#ffffff'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.75em'
                                }}
                            >
                                <h3
                                    style={{
                                        margin: 0,
                                        fontSize: '1.1em',
                                        fontWeight: 600,
                                        color: theme?.textColor || '#111827'
                                    }}
                                >
                                    Full Transit Report
                                </h3>
                                <div style={{ display: 'flex', gap: '0.5em' }}>
                                    <button
                                        type="button"
                                        onClick={handleCopyReport}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: theme?.buttonBgColor || '#3b82f6',
                                            color: theme?.buttonTextColor || 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8em',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {copied ? 'Copied!' : 'Copy Report'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadReport('txt')}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#4b5563',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8em'
                                        }}
                                    >
                                        Download .txt
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadReport('md')}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#1f2937',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8em'
                                        }}
                                    >
                                        Download .md
                                    </button>
                                </div>
                            </div>
                            <pre
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    margin: 0,
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                    fontSize: '0.85em',
                                    lineHeight: 1.5
                                }}
                            >
                                {result}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
