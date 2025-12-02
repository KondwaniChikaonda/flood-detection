"use client";

import React, { useEffect, useState } from 'react';

export default function PortalPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [rainfallData, setRainfallData] = useState<any[]>([]);

  // Alert modal state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'High' | 'Moderate' | 'Watch'>('High');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  // Load rainfall data
  useEffect(() => {
    const fetchRainfall = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=-13.9626&longitude=33.75&hourly=precipitation`
        );
        const data = await res.json();
        const hourly = data.hourly?.precipitation || [];
        const times = data.hourly?.time || [];
        const intensity = hourly[hourly.length - 1] || 0;
        const time = times[times.length - 1] || new Date().toISOString();

        const points: any[] = [];
        const step = 0.7;
        const MalawiBbox = { minLat: -16.0, maxLat: -9.25, minLng: 32.67, maxLng: 35.92 };
        for (let lat = MalawiBbox.minLat; lat <= MalawiBbox.maxLat; lat += step) {
          for (let lng = MalawiBbox.minLng; lng <= MalawiBbox.maxLng; lng += step) {
            const variation = (Math.random() - 0.5) * 2;
            points.push({ lat, lng, intensity: Math.max(intensity + variation, 0), time });
          }
        }
        setRainfallData(points);
      } catch (err) {
        console.error("Error fetching precipitation", err);
      }
    };
    fetchRainfall();
  }, []);

  useEffect(() => {
    if (rainfallData.length === 0) return;

    // set client-side last update string to avoid SSR/CSR mismatch
    setLastUpdate(new Date().toLocaleString());

    // fetch top risk areas for recent activity and enrich with district, risk and predicted date
    (async () => {
      try {
        const res = await fetch('/api/search?layer=areas&limit=10&includeGeom=true');
        const data = await res.json();
        if (data?.features) {
          // map and enrich each feature
          const enrichPromises = data.features.map(async (f: any) => {
            const props = f.properties || {};
            const name = props?.TA3_name || props?.ta3_name || props?.TA || props?.ta || props?.name || 'Unknown';
            const district = props?.DISTRICT || props?.district || props?.district_name || 'Unknown';

            let risk: number | null = null;
            let rainfall: number | null = null;

            // compute centroid from geometry if available
            let lat: number | undefined;
            let lng: number | undefined;
            if (f.geometry && f.geometry.type && f.geometry.coordinates) {
              const geom = f.geometry;
              // Simple centroid logic
              if (geom.type === 'Point') {
                lng = geom.coordinates[0];
                lat = geom.coordinates[1];
              } else if (Array.isArray(geom.coordinates)) {
                const findPair = (arr: any): any => {
                  if (!Array.isArray(arr)) return null;
                  if (typeof arr[0] === 'number' && typeof arr[1] === 'number') return arr;
                  for (const item of arr) {
                    const p = findPair(item);
                    if (p) return p;
                  }
                  return null;
                };
                const pair = findPair(geom.coordinates);
                if (pair) {
                  lng = pair[0];
                  lat = pair[1];
                }
              }
            }

            if (lat !== undefined && lng !== undefined) {
              // Find nearest rainfall
              const nearestRain = rainfallData.reduce((acc, p) => {
                const d = Math.hypot(p.lat - lat!, p.lng - lng!);
                return d < acc.d ? { p, d } : acc;
              }, { p: rainfallData[0], d: Infinity } as any);
              rainfall = nearestRain?.p?.intensity || 0;

              try {
                const rres = await fetch(`/api/risk?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&rainfall=${rainfall}`);
                const rdata = await rres.json();
                if (rdata && typeof rdata.risk === 'number') risk = Math.round(rdata.risk);
              } catch (err) {
                console.warn('failed to fetch risk for feature', err);
              }
            }

            // Fallback to server risk if calculation failed
            if (risk === null && typeof props?.risk_score === 'number') risk = props.risk_score;

            // compute predicted date from risk (simple heuristic)
            const predictFloodDateFromRisk = (r: number | null, base = new Date()) => {
              if (r === null || typeof r === 'undefined') return 'Unknown';
              const days = r >= 80 ? 1 : r >= 60 ? 3 : r >= 40 ? 7 : r >= 20 ? 14 : 30;
              const d = new Date(base);
              d.setDate(d.getDate() + days);
              return d.toLocaleDateString();
            };

            const predictedDate = predictFloodDateFromRisk(risk);

            const description = risk === null ? 'Risk unknown' : (risk >= 80 ? 'High likelihood of flooding — urgent action advised' : risk >= 60 ? 'Significant risk — prepare for possible flooding' : risk >= 40 ? 'Moderate risk — monitor closely' : risk >= 20 ? 'Low risk — stay informed' : 'Minimal risk');

            return {
              id: props?.id || props?.gid || `${name}-${district}`,
              name,
              district,
              risk,
              rainfall,
              predictedDate,
              description,
            };
          });

          const items = await Promise.all(enrichPromises);

          // Sort by risk (descending)
          items.sort((a, b) => {
            const riskA = a.risk ?? -1;
            const riskB = b.risk ?? -1;
            return riskB - riskA;
          });

          setRecentActivity(items);

          // generate alerts from high-risk recentActivity
          const generatedAlerts: any[] = items.flatMap((it) => {
            if (!it || typeof it.risk !== 'number' || it.risk < 40) return []; // Only alert for risk >= 40
            const level = it.risk >= 80 ? 'High' : it.risk >= 60 ? 'Moderate' : 'Watch';
            const msg = `${it.name} (${it.district}) — risk ${it.risk}%. Rainfall: ${it.rainfall?.toFixed(1)}mm. ${it.description}`;
            return [{ id: `a-${it.id}`, level, message: msg, time: new Date().toISOString(), areaId: it.id }];
          });
          if (generatedAlerts.length) setAlerts(generatedAlerts);
        }
      } catch (e) {
        console.error('fetch recent activity failed', e);
      }
    })();
  }, [rainfallData]);

  const exportCSV = (rows: any[], filename = 'export.csv') => {
    if (!rows || rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // simple printable view - user can Save as PDF
    const content = document.getElementById('portal-content');
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>Portal Report</title></head><body>');
    w.document.write(content.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    w.print();
  };

  const handleProviderToggle = (provider: string) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const handleSendAlert = () => {
    if (!alertMessage.trim()) {
      alert('Please enter an alert message');
      return;
    }
    if (selectedProviders.length === 0) {
      alert('Please select at least one telecommunications provider');
      return;
    }

    // Log alert details (in production, this would call an API)
    console.log('Sending alert:', {
      message: alertMessage,
      severity: alertSeverity,
      providers: selectedProviders,
      timestamp: new Date().toISOString()
    });

    // Show success message
    alert(`Alert sent to: ${selectedProviders.join(', ')}`);

    // Reset form and close modal
    setAlertMessage('');
    setAlertSeverity('High');
    setSelectedProviders([]);
    setShowAlertModal(false);
  };

  return (
    <div id="portal-content" style={{ padding: 28, fontFamily: 'Inter, system-ui, -apple-system, Roboto, sans-serif', background: '#f4f6f8', minHeight: '100vh', color: '#000' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Disaster Portal</h1>
          <div style={{ color: '#222', marginTop: 6 }}>Centralized alerts, status and actions</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#666' }}>Welcome</div>
            <div style={{ fontWeight: 700 }}>Portal User</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15 8H9L12 2Z" fill="#ff7043" /><path d="M12 22V9" stroke="#000" strokeWidth="1.2" strokeLinecap="round" /></svg>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Active Alerts</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{alerts.length}</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#000" strokeWidth="1.2" /><path d="M8 12h8" stroke="#000" strokeWidth="1.2" strokeLinecap="round" /></svg>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Top Risk Area</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{recentActivity[0]?.name ?? 'N/A'}</div>
              {recentActivity[0] && (
                <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
                  {recentActivity[0].district ? `District: ${recentActivity[0].district}` : ''}
                  {recentActivity[0].risk !== null && recentActivity[0].risk !== undefined ? ` • Risk: ${recentActivity[0].risk}%` : ''}
                  {recentActivity[0].rainfall !== null && recentActivity[0].rainfall !== undefined ? ` • Rain: ${recentActivity[0].rainfall.toFixed(1)}mm` : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h18" stroke="#000" strokeWidth="1.2" strokeLinecap="round" /><path d="M12 3v18" stroke="#000" strokeWidth="1.2" strokeLinecap="round" /></svg>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Last Update</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{lastUpdate || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)', marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Active Alerts</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {alerts.map(a => (
                <li key={a.id} style={{ padding: 12, borderRadius: 8, marginBottom: 8, background: '#fff', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{a.level}</div>
                      <div style={{ color: '#222' }}>{a.message}</div>
                    </div>
                    <div style={{ color: '#666', fontSize: 12 }}>{new Date(a.time).toLocaleString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
            <h3 style={{ marginTop: 0 }}>Recent Activity</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {recentActivity.length ? recentActivity.map((r) => (
                <li key={r.id} style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.name}</div>
                      <div style={{ fontSize: 13, color: '#444' }}>
                        {r.district ? `District: ${r.district}` : ''}
                        {r.rainfall !== undefined ? ` • Rain: ${r.rainfall.toFixed(1)}mm` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: r.risk >= 80 ? '#dc3545' : r.risk >= 60 ? '#ffc107' : '#28a745' }}>{r.risk !== null && r.risk !== undefined ? `${r.risk}%` : '—'}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{r.predictedDate || '—'}</div>
                    </div>
                  </div>
                  {r.description && <div style={{ marginTop: 8, color: '#333' }}>{r.description}</div>}
                </li>
              )) : <li style={{ padding: 8, color: '#666' }}>No recent activity</li>}
            </ul>
          </div>
        </div>

        <aside>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
            <h4 style={{ marginTop: 0 }}>Quick Actions</h4>
            <button onClick={() => window.location.href = '/map'} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 8, border: 'none', background: '#000', color: '#fff' }}>View Live Map</button>
            <button onClick={() => setShowAlertModal(true)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 8, border: 'none', background: '#ff7043', color: '#fff', cursor: 'pointer' }}>Create Alert</button>
            <button onClick={() => exportCSV(alerts, 'alerts.csv')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 8 }}>Export CSV</button>
            <button onClick={() => exportPDF()} style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}>Export PDF</button>
          </div>
        </aside>
      </div>

      {/* Alert Creation Modal */}
      {showAlertModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 500, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Create Flood Alert</h2>
              <button onClick={() => setShowAlertModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: 0, color: '#666' }}>×</button>
            </div>

            {/* Alert Severity */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#333' }}>Alert Severity</label>
              <select
                value={alertSeverity}
                onChange={(e) => setAlertSeverity(e.target.value as any)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
              >
                <option value="High">High - Urgent Action Required</option>
                <option value="Moderate">Moderate - Prepare for Flooding</option>
                <option value="Watch">Watch - Monitor Situation</option>
              </select>
            </div>

            {/* Alert Message */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#333' }}>Alert Message</label>
              <textarea
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="Enter flood alert message..."
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Telecommunications Providers */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: '#333' }}>Send Alert To:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Airtel', 'TNM', 'MBC (Malawi Broadcasting Corporation)', 'Times TV', 'Zodiak Broadcasting', 'Radio Maria', 'Other Providers'].map(provider => (
                  <label key={provider} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, border: '1px solid #eee', cursor: 'pointer', background: selectedProviders.includes(provider) ? '#f0f7ff' : '#fff' }}>
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(provider)}
                      onChange={() => handleProviderToggle(provider)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 14, color: '#333' }}>{provider}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAlertModal(false)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendAlert}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#ff7043', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Send Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
