import { useMemo, useState, useEffect, useRef } from 'react'
import { EphemerisService } from './services/EphemerisService';
import { Bodygraph } from './components/Bodygraph';
import { PlanetPanel } from './components/PlanetPanel';
import { ChartData } from './services/HumanDesignLogic';
import { AppTheme } from './types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Initialize service (singleton pattern for the app lifespan)
const ephemerisService = new EphemerisService('assets/ephe');

function App() {
  const [input, setInput] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    timezone: '',
    latitude: '',
    longitude: ''
  });
  const [result, setResult] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<Array<{city:string; admin_name:string; country:string; latitude:number; longitude:number}>>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [tzSearch, setTzSearch] = useState('');
  const [showForm, setShowForm] = useState(true);

  const [theme, setTheme] = useState<AppTheme | undefined>(undefined);
  const [savedCharts, setSavedCharts] = useState<Array<{id: number; name: string; date: string; input: typeof input; report: string; chartData?: ChartData}>>([]);
  const [showSavedCharts, setShowSavedCharts] = useState(false);
  const [copied, setCopied] = useState(false);
  const chartExportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
      if (window.ahdSettings && window.ahdSettings.theme) {
          setTheme(window.ahdSettings.theme);
      }
      // Load saved charts from localStorage
      const stored = localStorage.getItem('ahd_saved_charts');
      if (stored) {
          setSavedCharts(JSON.parse(stored));
      }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log("Submitting", input);
      // Run both calculations in parallel
      const [textReport, dataObj] = await Promise.all([
          ephemerisService.calculateChart(input),
          ephemerisService.getChartData(input)
      ]);
      
      setResult(textReport);
      setChartData(dataObj);
      setShowForm(false);
    } catch (error) {
      console.error(error);
      setResult("Error calculating chart. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChart = () => {
      if (!result || !chartData) return;
      // Save to localStorage
      // Serialize Set properties so they survive JSON.stringify/parse
      const serializableChartData: any = {
          ...chartData,
          definedCenters: Array.from(chartData.definedCenters),
          activeGates: Array.from(chartData.activeGates),
      };

      const newChart = {
          id: Date.now(),
          name: input.name || 'Unnamed Chart',
          date: new Date().toISOString(),
          input: input,
          report: result,
          chartData: serializableChartData
      };
      const updatedCharts = [...savedCharts, newChart];
      setSavedCharts(updatedCharts);
      localStorage.setItem('ahd_saved_charts', JSON.stringify(updatedCharts));
      setShowSavedCharts(true); // Show the dropdown after saving
  };

  const handleLoadSavedChart = async (chart: typeof savedCharts[0]) => {
      setInput(chart.input);
      setCityQuery(chart.input.location);
      setTzSearch(chart.input.timezone);
      setShowSavedCharts(false);

      // Use saved data if available, otherwise recalculate
      if (chart.chartData && chart.report) {
          setResult(chart.report);
          // Rehydrate Sets that were stringified when saving to localStorage
          const raw: any = chart.chartData;
          const fixedChartData: ChartData = {
              ...raw,
              definedCenters:
                  raw.definedCenters instanceof Set
                      ? raw.definedCenters
                      : new Set(Array.isArray(raw.definedCenters) ? raw.definedCenters : []),
              activeGates:
                  raw.activeGates instanceof Set
                      ? raw.activeGates
                      : new Set(Array.isArray(raw.activeGates) ? raw.activeGates : []),
          };

          setChartData(fixedChartData);
          setShowForm(false);
          return;
      }

      // Recalculate the chart data
      setLoading(true);
      try {
          const [textReport, dataObj] = await Promise.all([
              ephemerisService.calculateChart(chart.input),
              ephemerisService.getChartData(chart.input)
          ]);
          setResult(textReport);
          setChartData(dataObj);
          setShowForm(false);
      } catch (error) {
          console.error(error);
          setResult("Error loading chart. Check console.");
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteSavedChart = (id: number) => {
      const updatedCharts = savedCharts.filter(c => c.id !== id);
      setSavedCharts(updatedCharts);
      localStorage.setItem('ahd_saved_charts', JSON.stringify(updatedCharts));
  };

  const handleNewChart = () => {
      setShowForm(true);
      setResult(null);
      setChartData(null);
      // Optionally clear input? Keeping it might be useful for tweaking.
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
          link.download = `${input.name || 'chart'}.png`;
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
              const lineHeight = 14; // pts
              let cursorY = textMargin;

              lines.forEach((line: string) => {
                  if (cursorY > pageHeight - textMargin) {
                      pdf.addPage();
                      cursorY = textMargin;
                  }
                  pdf.text(line, textMargin, cursorY);
                  cursorY += lineHeight;
              });
          }

          pdf.save(`${input.name || 'chart'}.pdf`);
      } catch (e) {
          console.error('Error exporting PDF', e);
      }
  };

  const handleCopyReport = async () => {
      if (!result) return;
      
      const copyToClipboard = async (text: string) => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
          } else {
              // Fallback for non-secure contexts
              const textArea = document.createElement("textarea");
              textArea.value = text;
              textArea.style.position = "fixed"; // Avoid scrolling to bottom
              textArea.style.left = "-9999px";
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

  const handleDownloadReport = (extension: 'txt' | 'md') => {
      if (!result) return;
      const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${input.name || 'chart'}-report.${extension}`;
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
      // Call WP REST API from the site root
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

  const handleCitySelect = (city: {city:string; admin_name:string; country:string; latitude:number; longitude:number}) => {
    setInput({
      ...input,
      location: `${city.city}, ${city.country}`,
      latitude: String(city.latitude),
      longitude: String(city.longitude),
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
      'Australia/Sydney',
    ],
    []
  );

  const filteredTimezones = useMemo(
    () => {
      const search = tzSearch.trim().toLowerCase();
      if (!search) return timezoneOptions;
      return timezoneOptions.filter(tz => tz.toLowerCase().includes(search));
    },
    [tzSearch, timezoneOptions]
  );

  return (
    <div className="ahd-container" style={{ width: '100%', boxSizing: 'border-box', maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: theme?.fontFamily, fontSize: `calc(16px * ${theme?.fontSizeScale || 1})` }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5em' }}>Human Design Chart</h1>
      
      {showForm ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', maxWidth: '600px', margin: '0 auto 0.75em' }}>
                {/* Saved Charts Dropdown on form */}
                {savedCharts.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => setShowSavedCharts(!showSavedCharts)}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: theme?.buttonBgColor || '#3b82f6',
                                color: theme?.buttonTextColor || 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '0.8em'
                            }}
                        >
                            Saved Charts ({savedCharts.length}) ▼
                        </button>
                        {showSavedCharts && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                    minWidth: '200px',
                                    zIndex: 50,
                                    maxHeight: '260px',
                                    overflowY: 'auto'
                                }}
                            >
                                {savedCharts.map(chart => (
                                    <div
                                        key={chart.id}
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid #f3f4f6',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleLoadSavedChart(chart)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                flex: 1,
                                                padding: 0
                                            }}
                                        >
                                            <div style={{ fontWeight: 500, color: '#1f2937' }}>{chart.name}</div>
                                            <div style={{ fontSize: '0.75em', color: '#6b7280' }}>
                                                {new Date(chart.date).toLocaleDateString()}
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); handleDeleteSavedChart(chart.id); }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#ef4444',
                                                fontSize: '1em',
                                                padding: '2px 6px'
                                            }}
                                            title="Delete"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

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
                <div>
                <label style={{ display: 'block', marginBottom: '0.5em' }}>Name</label>
                <input 
                    type="text" 
                    value={input.name}
                    onChange={e => setInput({...input, name: e.target.value})}
                    style={{
                        width: '100%',
                        padding: '0.5em 0.75em',
                        borderRadius: '0.375em',
                        border: `1px solid ${theme?.inputBorderColor || '#d1d5db'}`,
                        backgroundColor: theme?.inputBgColor || '#ffffff'
                    }}
                />
                </div>
                <div style={{ display: 'flex', gap: '1em' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5em' }}>Date</label>
                    <input 
                    type="date" 
                    value={input.date}
                    onChange={e => setInput({...input, date: e.target.value})}
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
                    onChange={e => setInput({...input, time: e.target.value})}
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
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5em 0', maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: 4 }}>
                    {cityResults.map((c, idx) => (
                        <li
                        key={`${c.city}-${c.country}-${idx}`}
                        onClick={() => handleCitySelect(c)}
                        style={{ padding: '0.4em 0.6em', cursor: 'pointer', borderBottom: '1px solid #eee' }}
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
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: 4 }}>
                    {filteredTimezones.map(tz => (
                    <li
                        key={tz}
                        onClick={() => {
                        setInput({ ...input, timezone: tz });
                        setTzSearch(tz);
                        }}
                        style={{ padding: '0.4em 0.6em', cursor: 'pointer', borderBottom: '1px solid #eee', background: input.timezone === tz ? '#e5e7eb' : 'white' }}
                    >
                        {tz}
                    </li>
                    ))}
                </ul>
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
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5em' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'ahd-spin 1s linear infinite' }}>
                            <style>{`@keyframes ahd-spin { 100% { transform: rotate(360deg); } }`}</style>
                            <path d="M12 22c5.421 0 10-4.579 10-10h-2c0 4.337-3.663 8-8 8s-8-3.663-8-8c0-4.336 3.663-8 8-8V2C6.579 2 2 6.58 2 12c0 5.421 4.579 10 10 10z" fill="currentColor"/>
                        </svg>
                        Calculating...
                    </span>
                ) : 'Generate Chart'}
                </button>
            </form>
          </>

      ) : (
          <div className="ahd-results-view">
              {/* Header with name and buttons */}
              <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '1.5em',
                  paddingBottom: '1em',
                  borderBottom: '1px solid #e5e7eb'
              }}>
                  <div>
                      <h2 style={{ 
                          margin: 0, 
                          fontSize: '1.5em', 
                          fontWeight: '600',
                          color: theme?.textColor || '#1f2937'
                      }}>
                          {input.name || 'Chart'}
                      </h2>
                      <p style={{ 
                          margin: '4px 0 0', 
                          fontSize: '0.875em', 
                          color: '#6b7280' 
                      }}>
                          {input.date} {input.time} • {input.location}
                      </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
                      <button 
                          onClick={handleSaveChart} 
                          style={{ 
                              padding: '8px 16px', 
                              backgroundColor: theme?.buttonBgColor || '#10b981', 
                              color: theme?.buttonTextColor || 'white', 
                              border: 'none', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              fontWeight: '500',
                              fontSize: '0.875em'
                          }}
                      >
                          Save Chart
                      </button>
                      <button 
                          onClick={handleNewChart} 
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
                          New Chart
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
                      
                      {/* Saved Charts Dropdown */}
                      {savedCharts.length > 0 && (
                          <div style={{ position: 'relative' }}>
                              <button 
                                  onClick={() => setShowSavedCharts(!showSavedCharts)} 
                                  style={{ 
                                      padding: '8px 16px', 
                                      backgroundColor: theme?.buttonBgColor || '#3b82f6', 
                                      color: theme?.buttonTextColor || 'white', 
                                      border: 'none', 
                                      borderRadius: '6px', 
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                      fontSize: '0.875em'
                                  }}
                              >
                                  Saved Charts ({savedCharts.length}) ▼
                              </button>
                              {showSavedCharts && (
                                  <div style={{
                                      position: 'absolute',
                                      top: '100%',
                                      right: 0,
                                      marginTop: '4px',
                                      backgroundColor: 'white',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '8px',
                                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                      minWidth: '200px',
                                      zIndex: 50,
                                      maxHeight: '300px',
                                      overflowY: 'auto'
                                  }}>
                                      {savedCharts.map(chart => (
                                          <div 
                                              key={chart.id}
                                              style={{
                                                  padding: '8px 12px',
                                                  borderBottom: '1px solid #f3f4f6',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center',
                                                  gap: '8px'
                                              }}
                                          >
                                              <button
                                                  onClick={() => handleLoadSavedChart(chart)}
                                                  style={{
                                                      background: 'none',
                                                      border: 'none',
                                                      cursor: 'pointer',
                                                      textAlign: 'left',
                                                      flex: 1,
                                                      padding: 0
                                                  }}
                                              >
                                                  <div style={{ fontWeight: '500', color: '#1f2937' }}>{chart.name}</div>
                                                  <div style={{ fontSize: '0.75em', color: '#6b7280' }}>
                                                      {new Date(chart.date).toLocaleDateString()}
                                                  </div>
                                              </button>
                                              <button
                                                  onClick={(e) => { e.stopPropagation(); handleDeleteSavedChart(chart.id); }}
                                                  style={{
                                                      background: 'none',
                                                      border: 'none',
                                                      cursor: 'pointer',
                                                      color: '#ef4444',
                                                      fontSize: '1em',
                                                      padding: '2px 6px'
                                                  }}
                                                  title="Delete"
                                              >
                                                  ×
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>

              {/* Main chart area with side panels and summary boxes (used for exports/PNG/PDF) */}
              <div
                  ref={chartExportRef}
                  style={{
                      padding: '24px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      width: '100%',
                      maxWidth: '1100px',
                      margin: '0 auto'
                  }}
              >
                  {/* Export header (name + basic details) */}
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                      <div style={{
                          fontSize: '1.25em',
                          fontWeight: 600,
                          color: theme?.textColor || '#111827'
                      }}>
                          {input.name || 'Chart'}
                      </div>
                      <div style={{
                          fontSize: '0.875em',
                          color: '#4b5563',
                          marginTop: '2px'
                      }}>
                          {input.date} {input.time}
                          {' · '}
                          {input.location}
                      </div>
                  </div>
                  <div style={{ 
                      display: 'flex', 
                      gap: '0.5em',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      marginBottom: '2em'
                  }}>
                      {/* Design Panel (Left) */}
                      {chartData && (
                          <PlanetPanel 
                              activations={chartData.designActivations}
                              side="design"
                              color={theme?.designColor || '#ef4444'}
                              textColor={theme?.textColor}
                              fontFamily={theme?.fontFamily}
                          />
                      )}
                      
                      {/* Bodygraph Center */}
                      <div style={{ 
                          flex: '0 0 350px',
                          width: '350px',
                          minHeight: '450px'
                      }}>
                          <Bodygraph data={chartData} theme={theme} />
                      </div>

                      {/* Personality Panel (Right) */}
                      {chartData && (
                          <PlanetPanel 
                              activations={chartData.birthActivations}
                              side="personality"
                              color={theme?.personalityColor || '#000000'}
                              textColor={theme?.textColor}
                              fontFamily={theme?.fontFamily}
                          />
                      )}
                  </div>
                  {/* Chart Details Section (Type/Authority/Profile/Definition) */}
                  <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1em',
                      marginBottom: '2em'
                  }}>
                      {chartData && (
                          <>
                              <div style={{ 
                                  padding: '1em', 
                                  background: '#f9fafb', 
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                              }}>
                                  <div style={{ fontSize: '0.75em', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Type</div>
                                  <div style={{ fontSize: '1.125em', fontWeight: '600', color: theme?.textColor || '#1f2937' }}>{chartData.type}</div>
                              </div>
                              <div style={{ 
                                  padding: '1em', 
                                  background: '#f9fafb', 
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                              }}>
                                  <div style={{ fontSize: '0.75em', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Authority</div>
                                  <div style={{ fontSize: '1.125em', fontWeight: '600', color: theme?.textColor || '#1f2937' }}>{chartData.authority}</div>
                              </div>
                              <div style={{ 
                                  padding: '1em', 
                                  background: '#f9fafb', 
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                              }}>
                                  <div style={{ fontSize: '0.75em', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Profile</div>
                                  <div style={{ fontSize: '1.125em', fontWeight: '600', color: theme?.textColor || '#1f2937' }}>
                                      {chartData.profile}
                                      {chartData.modality && <span style={{ fontSize: '0.85em', fontWeight: '400', color: '#6b7280', marginLeft: '6px' }}>({chartData.modality})</span>}
                                  </div>
                              </div>
                              <div style={{ 
                                  padding: '1em', 
                                  background: '#f9fafb', 
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                              }}>
                                  <div style={{ fontSize: '0.75em', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Definition</div>
                                  <div style={{ fontSize: '1.125em', fontWeight: '600', color: theme?.textColor || '#1f2937' }}>{chartData.definition}</div>
                              </div>
                          </>
                      )}
                  </div>
              </div>

              {/* Detailed Report (collapsible) */}
              {result && (
                  <div style={{ width: '100%', maxWidth: '1100px', margin: '1em auto' }}>
                  <details style={{ marginTop: '1em' }}>
                      <summary style={{ 
                          cursor: 'pointer', 
                          padding: '0.75em 1em',
                          background: '#f3f4f6',
                          borderRadius: '8px',
                          fontWeight: '500',
                          color: theme?.textColor || '#374151'
                      }}>
                          View Full Report
                      </summary>
                      <div style={{ 
                          padding: '1em', 
                          background: '#f9fafb', 
                          borderRadius: '0 0 8px 8px',
                          marginTop: '-4px',
                          border: '1px solid #e5e7eb',
                          borderTop: 'none'
                      }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5em', marginBottom: '0.75em' }}>
                              <button
                                  type="button"
                                  onClick={handleCopyReport}
                                  style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid #d1d5db',
                                      backgroundColor: 'white',
                                      color: '#374151', // Explicit text color
                                      cursor: 'pointer',
                                      fontSize: '0.75em',
                                      transition: 'all 0.2s ease',
                                      minWidth: '60px'
                                  }}
                              >
                                  {copied ? 'Copied!' : 'Copy'}
                              </button>
                              <button
                                  type="button"
                                  onClick={() => handleDownloadReport('txt')}
                                  style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid #d1d5db',
                                      backgroundColor: 'white',
                                      color: '#374151', // Explicit text color
                                      cursor: 'pointer',
                                      fontSize: '0.75em'
                                  }}
                              >
                                  Download TXT
                              </button>
                              <button
                                  type="button"
                                  onClick={() => handleDownloadReport('md')}
                                  style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid #d1d5db',
                                      backgroundColor: 'white',
                                      color: '#374151', // Explicit text color
                                      cursor: 'pointer',
                                      fontSize: '0.75em'
                                  }}
                              >
                                  Download MD
                              </button>
                          </div>
                          <pre style={{ 
                              whiteSpace: 'pre-wrap', 
                              fontSize: '0.8125em',
                              lineHeight: '1.6',
                              color: '#374151',
                              margin: 0,
                              fontFamily: 'ui-monospace, monospace',
                              overflowX: 'auto'
                          }}>{result}</pre>
                      </div>
                  </details>
                  </div>
              )}
          </div>
      )}
    </div>
  )
}

export default App
