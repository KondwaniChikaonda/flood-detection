"use client";

import React, { useEffect, useState } from 'react';

export default function PortalPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
  // placeholder alerts removed; alerts will be generated from recentActivity once it's loaded
    // set client-side last update string to avoid SSR/CSR mismatch
    setLastUpdate(new Date().toLocaleString());

    // fetch top risk areas for recent activity and enrich with district, risk and predicted date
    (async () => {
      try {
        const res = await fetch('/api/search?layer=areas&limit=5&includeGeom=true');
        const data = await res.json();
        if (data?.features) {
          // map and enrich each feature
          const enrichPromises = data.features.map(async (f: any) => {
            const props = f.properties || {};
            const name = props?.TA3_name || props?.ta3_name || props?.TA || props?.ta || props?.name || 'Unknown';
            const district = props?.DISTRICT || props?.district || props?.district_name || 'Unknown';
            // prefer server-provided risk_score if present
            let risk: number | null = null;
            if (typeof props?.risk_score === 'number') risk = props.risk_score;

            // if no risk_score, attempt to compute by calling /api/risk for the feature centroid
            if (risk === null) {
              try {
                // compute centroid from geometry if available
                let lat: number | undefined;
                let lng: number | undefined;
                if (f.geometry && f.geometry.type && f.geometry.coordinates) {
                  // handle Polygon/MultiPolygon/Point/LineString simply by taking first coordinate
                  const geom = f.geometry;
                  if (geom.type === 'Point') {
                    lng = geom.coordinates[0];
                    lat = geom.coordinates[1];
                  } else if (Array.isArray(geom.coordinates)) {
                    // dig into nested arrays to find a coordinate pair
                    let pair: any = null;
                    const findPair = (arr: any): any => {
                      if (!Array.isArray(arr)) return null;
                      if (typeof arr[0] === 'number' && typeof arr[1] === 'number') return arr;
                      for (const item of arr) {
                        const p = findPair(item);
                        if (p) return p;
                      }
                      return null;
                    };
                    pair = findPair(geom.coordinates);
                    if (pair) {
                      lng = pair[0];
                      lat = pair[1];
                    }
                  }

                }
                if (lat !== undefined && lng !== undefined) {
                  const rres = await fetch(`/api/risk?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
                  const rdata = await rres.json();
                  if (rdata && typeof rdata.risk === 'number') risk = Math.round(rdata.risk);
                }
              } catch (err) {
                console.warn('failed to fetch risk for feature', err);
              }
            }

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
              predictedDate,
              description,
            };
          });

          const items = await Promise.all(enrichPromises);
          setRecentActivity(items);
          // generate alerts from high-risk recentActivity
          const generatedAlerts: any[] = items.flatMap((it) => {
            if (!it || typeof it.risk !== 'number') return [];
            const level = it.risk >= 80 ? 'High' : it.risk >= 60 ? 'Moderate' : it.risk >= 40 ? 'Watch' : 'Low';
            const msg = `${it.name} (${it.district}) — risk ${it.risk}. ${it.description}`;
            return [{ id: `a-${it.id}`, level, message: msg, time: new Date().toISOString(), areaId: it.id }];
          });
          if (generatedAlerts.length) setAlerts(generatedAlerts);
        }
      } catch (e) {
        console.error('fetch recent activity failed', e);
      }
    })();
  }, []);

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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15 8H9L12 2Z" fill="#ff7043"/><path d="M12 22V9" stroke="#000" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Active Alerts</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{alerts.length}</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#000" strokeWidth="1.2"/><path d="M8 12h8" stroke="#000" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>Top Risk Area</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{recentActivity[0]?.name ?? 'N/A'}</div>
              {recentActivity[0] && (
                <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
                  {recentActivity[0].district ? `District: ${recentActivity[0].district}` : ''}
                  {recentActivity[0].risk !== null && recentActivity[0].risk !== undefined ? ` • Risk: ${recentActivity[0].risk}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h18" stroke="#000" strokeWidth="1.2" strokeLinecap="round"/><path d="M12 3v18" stroke="#000" strokeWidth="1.2" strokeLinecap="round"/></svg>
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
                      <div style={{ fontSize: 13, color: '#444' }}>{r.district ? `District: ${r.district}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800 }}>{r.risk !== null && r.risk !== undefined ? `${r.risk}` : '—'}</div>
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
            <button style={{ width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 8 }}>Create Alert</button>
            <button onClick={() => exportCSV(alerts, 'alerts.csv')} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 8 }}>Export CSV</button>
            <button onClick={() => exportPDF()} style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}>Export PDF</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
