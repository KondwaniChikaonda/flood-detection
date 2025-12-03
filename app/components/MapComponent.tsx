"use client";

import React, { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Popup,
  useMap,
  GeoJSON,
  useMapEvents,
  CircleMarker,
} from "react-leaflet";
import ChatComponent from "./ChatComponent";

type RainPoint = {
  lat: number;
  lng: number;
  intensity: number;
  time: string;
  name?: string;
};

const MalawiBbox = {
  minLat: -16.0,
  maxLat: -9.25,
  minLng: 32.67,
  maxLng: 35.92,
};

// Legend component
const Legend: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const div = L.DomUtil.create("div", "info legend");
    div.style.background = "rgba(255,255,255,0.95)";
    div.style.padding = "10px 12px";
    div.style.borderRadius = "8px";
    div.style.color = "#1a1a1a";
    div.style.fontSize = "12px";
    div.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    div.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    const grades = [0, 0.1, 2, 5, 10];
    const colors = ["#00ff00", "#ffff00", "#ffa500", "#ff4500", "#ff0000"];
    const labels = ["None", "Light", "Moderate", "Heavy", "Very Heavy"];

    div.innerHTML =
      `<div style="font-weight: 700; margin-bottom: 8px; color: #0066cc;">Rainfall Intensity</div>` +
      grades
        .map((from, i) => {
          const to = grades[i + 1] || "+";
          const label = labels[i];
          return `<div style="display: flex; align-items: center; margin-bottom: 4px;">
            <i style="background:${colors[i]}; width: 16px; height: 16px; display:inline-block; margin-right:8px; border-radius: 50%; border: 1px solid #ccc;"></i> 
            <span style="font-size: 11px;">${from} - ${to} mm <em>(${label})</em></span>
          </div>`;
        })
        .join("");

    const control = new (L.Control as any)({ position: "bottomright" });
    (control as any).onAdd = () => div;
    (control as any).addTo(map);
    return () => (control as any).remove();
  }, [map]);
  return null;
};

const MapClickHandler: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapComponent: React.FC = () => {
  const [rainfallData, setRainfallData] = useState<RainPoint[]>([]);
  const [riversGeo, setRiversGeo] = useState<any | null>(null);
  const [roadsGeo, setRoadsGeo] = useState<any | null>(null);
  const [districtsGeo, setDistrictsGeo] = useState<any | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchLayer, setSearchLayer] = useState<'districts' | 'roads' | 'rivers' | 'areas'>('districts');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [riskInfo, setRiskInfo] = useState<any | null>(null);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [rainfallUpdates, setRainfallUpdates] = useState<any[]>([]);
  const mapRef = useRef<any>(null);

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

        const points: RainPoint[] = [];
        const step = 0.7;
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

  // Load geo layers
  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, roadsRes, dRes] = await Promise.all([
          fetch(`/api/geodata?layer=rivers`),
          fetch(`/api/geodata?layer=roads`),
          fetch(`/api/geodata?layer=districts`),
        ]);

        const [rJson, roadsJson, dJson] = await Promise.all([rRes.json(), roadsRes.json(), dRes.json()]);
        if (rJson?.error) console.error('geodata rivers error', rJson.error);
        if (roadsJson?.error) console.error('geodata roads error', roadsJson.error);
        if (dJson?.error) console.error('geodata districts error', dJson.error);

        if (!rJson?.error) setRiversGeo(rJson);
        if (!roadsJson?.error) setRoadsGeo(roadsJson);
        if (!dJson?.error) setDistrictsGeo(dJson);
      } catch (err) {
        console.error("Failed to load geo layers", err);
      }
    };
    load();
  }, []);

  // Load top-10 high-risk areas on mount with full risk calculation
  useEffect(() => {
    const loadTopAreas = async () => {
      try {
        const res = await fetch('/api/search?layer=areas&limit=10');
        const data = await res.json();
        if (data?.features?.length) {
          // Wait for rainfall data to be available
          const checkRainfall = setInterval(async () => {
            if (rainfallData.length > 0) {
              clearInterval(checkRainfall);

              const enrichedAreas = await Promise.all(data.features.map(async (f: any) => {
                const props = f.properties || {};
                let r: number | null = null;
                let dist_m: number | null = null;
                let rf: number | null = null;
                let nearestArea: any = null;

                const c = getFeatureCenter(f);
                if (c) {
                  const [lng, lat] = c;
                  const nearestRain = rainfallData.reduce((acc, p) => {
                    const d = Math.hypot(p.lat - lat, p.lng - lng);
                    return d < acc.d ? { p, d } : acc;
                  }, { p: rainfallData[0], d: Infinity } as any);
                  const rainfall = nearestRain?.p?.intensity || 0;

                  try {
                    const rres = await fetch(`/api/risk?lat=${lat}&lng=${lng}&rainfall=${rainfall}`);
                    const rdata = await rres.json();
                    r = normalizeRisk(rdata.risk);
                    dist_m = rdata.dist_m ?? null;
                    rf = rdata.rainfall ?? null;
                    nearestArea = rdata.nearestArea ?? null;
                  } catch (e) {
                    console.error('Risk calculation failed for area', e);
                  }
                }

                // Fallback to database risk_score if calculation failed
                if (r === null) {
                  const raw = props?.risk_score ?? null;
                  r = normalizeRisk(raw);
                }

                const now = new Date();
                const predicted = predictFloodDateFromRisk(r, now);
                const advice = r === null ? 'Risk unknown' : (r >= 75 ? 'High risk — move to higher ground and follow local authority orders' : r >= 40 ? 'Moderate risk — avoid low-lying areas and monitor updates' : 'Low risk — stay informed');
                const enriched = {
                  risk: r,
                  advice,
                  predictedFloodDate: predicted.toISOString(),
                  currentDate: now.toISOString(),
                  nearestArea: nearestArea || { TA3_name: props?.TA3_name || props?.ta3_name, DISTRICT: props?.DISTRICT || props?.district },
                  rainfall: rf,
                  dist_m
                };

                return {
                  feature: { id: props?.id || props?.gid || '', props },
                  risk: r,
                  dist_m: dist_m,
                  rainfall: rf,
                  currentDate: now.toISOString(),
                  predictedFloodDate: predicted.toISOString(),
                  advice,
                  enriched
                };
              }));

              // Sort by risk (descending)
              enrichedAreas.sort((a, b) => {
                const riskA = a.risk ?? -1;
                const riskB = b.risk ?? -1;
                return riskB - riskA;
              });

              setScanResults(enrichedAreas.slice(0, 10));
            }
          }, 100);

          // Timeout after 5 seconds if rainfall data doesn't load
          setTimeout(() => clearInterval(checkRainfall), 5000);
        }
      } catch (e) {
        console.error('load top areas failed', e);
      }
    };
    loadTopAreas();
  }, [rainfallData]);

  // Identify high rainfall areas independently of risk score
  useEffect(() => {
    const loadRainfallUpdates = async () => {
      if (rainfallData.length === 0) return;

      // 1. Sort rainfall points by intensity (descending)
      const sortedRain = [...rainfallData].sort((a, b) => b.intensity - a.intensity);

      // 2. Take top unique points (simple spatial deduplication)
      const topPoints: RainPoint[] = [];
      const used = new Set<string>();
      for (const p of sortedRain) {
        if (p.intensity <= 0) break; // No rain
        const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
        if (!used.has(key)) {
          used.add(key);
          topPoints.push(p);
        }
        if (topPoints.length >= 10) break;
      }

      if (topPoints.length === 0) {
        setRainfallUpdates([]);
        return;
      }

      // 3. Fetch area details for these points
      const updates = await Promise.all(topPoints.map(async (p) => {
        try {
          const res = await fetch(`/api/risk?lat=${p.lat}&lng=${p.lng}&rainfall=${p.intensity}`);
          const data = await res.json();

          // We care about the location name and the rainfall, risk is secondary here
          const nearestArea = data.nearestArea || {
            TA3_name: `Lat ${p.lat.toFixed(2)}, Lng ${p.lng.toFixed(2)}`,
            DISTRICT: 'Unknown Location'
          };

          const now = new Date();
          const risk = normalizeRisk(data.risk);
          const predicted = predictFloodDateFromRisk(risk, now);

          return {
            feature: { props: nearestArea }, // Mock feature structure for compatibility
            rainfall: p.intensity,
            risk,
            predictedFloodDate: predicted.toISOString(),
            advice: p.intensity > 50 ? "Extreme rain - Evacuate low areas" :
              p.intensity > 20 ? "Heavy rain - Be prepared" :
                p.intensity > 5 ? "Moderate rain - Stay alert" : "Monitor situation"
          };
        } catch (e) {
          console.error('Failed to fetch info for rain point', e);
          return null;
        }
      }));

      // 4. Filter valid and deduplicate by area name
      const uniqueUpdates: any[] = [];
      const seenAreas = new Set<string>();

      for (const u of updates) {
        if (!u) continue;
        const name = u.feature.props.TA3_name || u.feature.props.ta3_name || u.feature.props.name;
        const district = u.feature.props.DISTRICT || u.feature.props.district;

        // Filter out unknown locations or raw coordinates
        if (!name || name.startsWith('Lat ') || district === 'Unknown Location') continue;

        if (!seenAreas.has(name)) {
          seenAreas.add(name);
          uniqueUpdates.push(u);
        }
      }

      setRainfallUpdates(uniqueUpdates.slice(0, 5));
    };

    loadRainfallUpdates();
  }, [rainfallData]);

  const onMapClick = async (lat: number, lng: number) => {
    const nearestRain = rainfallData.reduce((acc, p) => {
      const d = Math.hypot(p.lat - lat, p.lng - lng);
      return d < acc.d ? { p, d } : acc;
    }, { p: rainfallData[0], d: Infinity } as any);

    const rainfall = nearestRain?.p?.intensity || 0;

    try {
      const res = await fetch(`/api/risk?lat=${lat}&lng=${lng}&rainfall=${rainfall}`);
      const data = await res.json();
      const now = new Date();
      const predicted = predictFloodDateFromRisk(data.risk, now);
      setRiskInfo({ ...data, currentDate: now.toISOString(), predictedFloodDate: predicted.toISOString() });
    } catch (err) {
      console.error("risk api failed", err);
    }
  };

  const onSearch = async () => {
    if (!searchQ && searchLayer !== 'areas') return;
    try {
      const districtParam = searchLayer === 'areas' && searchDistrict ? `&district=${encodeURIComponent(searchDistrict)}` : '';
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQ)}&layer=${encodeURIComponent(searchLayer)}${districtParam}`);
      const data = await res.json();
      setSearchResults(data);

      if (data?.features?.length && mapRef.current) {
        const feat = data.features[0];
        const bounds = getFeatureBounds(feat);
        if (bounds && mapRef.current && typeof mapRef.current.fitBounds === 'function') {
          mapRef.current.fitBounds(bounds as any);
        } else {
          const center = getFeatureCenter(feat);
          if (center) {
            const [lng, lat] = center;
            if (mapRef.current && typeof mapRef.current.flyTo === 'function') {
              mapRef.current.flyTo([lat, lng], 12);
            }
          }
        }
      }

      // Enrich search results
      try {
        const top = data.features ? data.features.slice(0, searchLayer === 'areas' ? 5 : (searchLayer === 'districts' ? 10 : 8)) : [];
        const enriched = await Promise.all(
          top.map(async (f: any) => {
            const c = getFeatureCenter(f);
            if (!c) return { feature: f, risk: null, advice: 'No location available' };
            const [lng, lat] = c;

            const nearestRain = rainfallData.reduce((acc, p) => {
              const d = Math.hypot(p.lat - lat, p.lng - lng);
              return d < acc.d ? { p, d } : acc;
            }, { p: rainfallData[0], d: Infinity } as any);
            const rainfall = nearestRain?.p?.intensity || 0;

            try {
              const res = await fetch(`/api/risk?lat=${lat}&lng=${lng}&rainfall=${rainfall}`);
              const r = await res.json();
              const nr = normalizeRisk(r.risk);
              let advice = 'No immediate action';
              if ((nr ?? -1) >= 75) advice = 'High risk — move to higher ground and follow local authority orders';
              else if ((nr ?? -1) >= 40) advice = 'Moderate risk — avoid low-lying areas and monitor updates';
              else advice = 'Low risk — stay informed';
              const now = new Date();
              const predicted = predictFloodDateFromRisk(nr, now);
              return { feature: f, risk: nr, advice, currentDate: now.toISOString(), predictedFloodDate: predicted.toISOString(), rainfall: r.rainfall };
            } catch (e) {
              return { feature: f, risk: null, advice: 'Risk check failed' };
            }
          })
        );
        setSearchResults({ ...data, enriched });
      } catch (e) {
        console.error('enrich search failed', e);
      }
    } catch (err) {
      console.error("search failed", err);
    }
  };

  const getFeatureCenter = (feat: any): [number, number] | null => {
    if (!feat || !feat.geometry) return null;
    try {
      const geom = feat.geometry;
      if (geom.type === 'Point') return geom.coordinates as [number, number];
      if (geom.type === 'Polygon') return geom.coordinates[0][0] as [number, number];
      if (geom.type === 'MultiPolygon') return geom.coordinates[0][0][0] as [number, number];
      if (geom.type === 'LineString') return geom.coordinates[Math.floor(geom.coordinates.length / 2)] as [number, number];
      return null;
    } catch (e) {
      return null;
    }
  };

  const getFeatureBounds = (feat: any): [[number, number], [number, number]] | null => {
    if (!feat || !feat.geometry) return null;
    try {
      const geom = feat.geometry;
      const coordsToLatLng = (c: any) => [c[1], c[0]] as [number, number];
      let latlngs: [number, number][] = [];
      if (geom.type === 'Point') latlngs = [coordsToLatLng(geom.coordinates)];
      else if (geom.type === 'LineString') latlngs = geom.coordinates.map((c: any) => coordsToLatLng(c));
      else if (geom.type === 'Polygon') latlngs = geom.coordinates.flat(1).map((c: any) => coordsToLatLng(c));
      else if (geom.type === 'MultiPolygon') latlngs = geom.coordinates.flat(2).map((c: any) => coordsToLatLng(c));
      if (latlngs.length === 0) return null;
      const lats = latlngs.map((p) => p[0]);
      const lngs = latlngs.map((p) => p[1]);
      const southWest: [number, number] = [Math.min(...lats), Math.min(...lngs)];
      const northEast: [number, number] = [Math.max(...lats), Math.max(...lngs)];
      return [southWest, northEast];
    } catch (e) {
      return null;
    }
  };

  const formatDate = (isoOrDate?: string | Date | null) => {
    if (!isoOrDate) return 'n/a';
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(d.getTime())) return 'n/a';
    return d.toLocaleString();
  };

  const predictFloodDateFromRisk = (risk: number | null | undefined, baseDate: Date = new Date()) => {
    const b = baseDate || new Date();
    const r = typeof risk === 'number' && !isNaN(risk) ? Math.max(0, Math.min(100, risk)) : 0;
    const days = r >= 75 ? 1 : r >= 50 ? 2 : r >= 25 ? 5 : r >= 10 ? 10 : 14;
    const predicted = new Date(b.getTime());
    predicted.setDate(predicted.getDate() + days);
    return predicted;
  };

  const normalizeRisk = (r: any) => {
    if (r === null || typeof r === 'undefined') return null;
    if (typeof r === 'number') {
      if (r >= 0 && r <= 100) return Math.round(r);
      if (r > 0 && r <= 1) return Math.round(r * 100);
      if (r >= 0 && r <= 10) return Math.round((r / 10) * 100);
      return Math.round(Math.max(0, Math.min(100, r)));
    }
    return null;
  };

  const scanVisibleArea = async () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();

    try {
      const sres = await fetch('/api/search?layer=areas&limit=10');
      const sdata = await sres.json();
      if (sdata?.features?.length) {
        const items = await Promise.all(sdata.features.map(async (f: any) => {
          const props = f.properties || {};
          let r: number | null = null;
          let dist_m: number | null = null;
          let rf: number | null = null;
          let nearestArea: any = null;
          const c = getFeatureCenter(f);
          if (c) {
            const [lng, lat] = c;
            const nearestRain = rainfallData.reduce((acc, p) => {
              const d = Math.hypot(p.lat - lat, p.lng - lng);
              return d < acc.d ? { p, d } : acc;
            }, { p: rainfallData[0], d: Infinity } as any);
            const rainfall = nearestRain?.p?.intensity || 0;
            try {
              const rres = await fetch(`/api/risk?lat=${lat}&lng=${lng}&rainfall=${rainfall}`);
              const rdata = await rres.json();
              r = normalizeRisk(rdata.risk);
              dist_m = rdata.dist_m ?? null;
              rf = rdata.rainfall ?? null;
              nearestArea = rdata.nearestArea ?? null;
            } catch (e) {
              // ignore
            }
          }
          if (r === null) {
            const raw = props?.risk_score ?? null;
            r = normalizeRisk(raw);
          }
          const now = new Date();
          const predicted = predictFloodDateFromRisk(r, now);
          const advice = r === null ? 'Risk unknown' : (r >= 75 ? 'High risk — move to higher ground and follow local authority orders' : r >= 40 ? 'Moderate risk — avoid low-lying areas and monitor updates' : 'Low risk — stay informed');
          const enriched = { risk: r, advice, predictedFloodDate: predicted.toISOString(), currentDate: now.toISOString(), nearestArea: nearestArea || { TA3_name: props?.TA3_name || props?.ta3_name, DISTRICT: props?.DISTRICT || props?.district }, rainfall: rf, dist_m };
          return { feature: { id: props?.id || props?.gid || '', props }, risk: r, dist_m: dist_m, rainfall: rf, currentDate: now.toISOString(), predictedFloodDate: predicted.toISOString(), advice, enriched };
        }));
        // Sort by risk (descending)
        items.sort((a, b) => {
          const riskA = a.risk ?? -1;
          const riskB = b.risk ?? -1;
          return riskB - riskA;
        });
        setScanResults(items.slice(0, 10));
        return;
      }
    } catch (e) {
      console.warn('server scan failed', e);
    }
  };

  const riversStyle = { color: "#1e88e5", weight: 2 };
  const roadsStyle = { color: "#444", weight: 1 };
  const districtStyle = { color: "#2e7d32", weight: 1, fillOpacity: 0.05 };

  const isFeatureCollection = (g: any) => {
    return g && typeof g === "object" && g.type === "FeatureCollection" && Array.isArray(g.features);
  };

  const onFeatureClick = async (e: any) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    await onMapClick(lat, lng);
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative", marginLeft: "20px", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ position: "absolute", zIndex: 600, left: 10, top: 10, width: 360, maxHeight: '85vh', overflow: 'auto', background: 'rgba(255,255,255,0.97)', padding: 16, borderRadius: 12, color: '#1a1a1a', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 700, color: '#0066cc', textAlign: "center" }}>Malawi Flood Risk Monitor</h2>

        <div style={{ marginBottom: 16, padding: 12, background: '#f0f7ff', borderRadius: 8, border: '1px solid #b3d9ff' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search district or area"
              style={{ padding: 10, flex: 1, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
            />
            <select value={searchLayer} onChange={(e) => setSearchLayer(e.target.value as any)} style={{ padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}>
              <option value="districts">Districts</option>
              <option value="roads">Roads</option>
              <option value="rivers">Rivers</option>
              <option value="areas">Areas (TA3)</option>
            </select>
          </div>
          {searchLayer === 'areas' && (
            <input value={searchDistrict} onChange={(e) => setSearchDistrict(e.target.value)} placeholder="Filter by district" style={{ padding: 10, width: '100%', marginBottom: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }} />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onSearch} style={{ flex: 1, padding: 10, background: '#0066cc', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Search</button>
            <button onClick={scanVisibleArea} style={{ flex: 1, padding: 10, background: '#28a745', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Scan Area</button>
          </div>
        </div>

        {searchResults?.features?.length ? (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0066cc' }}>Search Results</h3>
            <ul style={{ maxHeight: 200, overflow: 'auto', paddingLeft: 0, listStyle: 'none' }}>
              {searchResults.features.map((f: any, idx: number) => {
                const name = f.properties?.ta3_name || f.properties?.TA3_name || f.properties?.ta_name || f.properties?.district || f.properties?.name || f.properties?.name_en || `Feature ${idx}`;
                const enriched = searchResults.enriched && searchResults.enriched.find((e: any) => e.feature === f);
                const risk = enriched?.risk ?? null;
                const riskColor = risk === null ? '#999' : risk >= 75 ? '#dc3545' : risk >= 40 ? '#ffc107' : '#28a745';
                const rainfall = (enriched as any)?.rainfall; // Access rainfall if available (needs to be added to enrichment)
                return (
                  <li key={idx} style={{ marginBottom: 10, padding: 10, background: '#f8f9fa', borderRadius: 6, borderLeft: `4px solid ${riskColor}` }}>
                    <button
                      onClick={() => {
                        const bounds = getFeatureBounds(f);
                        if (bounds && mapRef.current && typeof mapRef.current.fitBounds === 'function') {
                          mapRef.current.fitBounds(bounds as any);
                        } else {
                          const center = getFeatureCenter(f);
                          if (center && mapRef.current && typeof mapRef.current.flyTo === 'function') {
                            const [lng, lat] = center;
                            mapRef.current.flyTo([lat, lng], 12);
                          }
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: '#0066cc', fontWeight: 700, fontSize: 14 }}
                    >
                      {name}
                    </button>
                    {enriched && (
                      <div style={{ fontSize: 12, marginTop: 6, padding: 8, background: 'white', borderRadius: 4 }}>
                        <div style={{ fontWeight: 700, color: riskColor }}>Risk Score: {risk ?? 'N/A'}%</div>
                        <div style={{ fontSize: 11, marginTop: 4, color: '#555' }}>
                          {rainfall !== undefined ? <span>Rainfall: <strong>{typeof rainfall === 'number' ? rainfall.toFixed(1) : rainfall} mm</strong><br /></span> : null}
                          {enriched.advice}
                        </div>
                        <div style={{ fontSize: 10, marginTop: 4, color: '#777' }}>Predicted: {formatDate(enriched.predictedFloodDate)}</div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0066cc' }}>Map Legend</h3>
          <div style={{ fontSize: 13, background: 'white', padding: 10, borderRadius: 6 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Geographic Features</div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ background: '#1e88e5', display: 'inline-block', width: 20, height: 3, marginRight: 8 }}></span>
                <span>Rivers</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ background: '#444', display: 'inline-block', width: 20, height: 3, marginRight: 8 }}></span>
                <span>Roads</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ background: '#2e7d32', display: 'inline-block', width: 20, height: 3, marginRight: 8, opacity: 0.3 }}></span>
                <span>District Boundaries</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0066cc' }}>Risk Levels</h3>
          <div style={{ fontSize: 13, background: 'white', padding: 10, borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, padding: 6, background: '#d4edda', borderRadius: 4 }}>
              <span style={{ background: '#28a745', display: 'inline-block', width: 24, height: 24, marginRight: 8, borderRadius: 4, fontWeight: 700, color: 'white', textAlign: 'center', lineHeight: '24px', fontSize: 11 }}>L</span>
              <div>
                <div style={{ fontWeight: 700, color: '#155724' }}>Low Risk (0-39%)</div>
                <div style={{ fontSize: 11, color: '#155724' }}>Stay informed, monitor updates</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, padding: 6, background: '#fff3cd', borderRadius: 4 }}>
              <span style={{ background: '#ffc107', display: 'inline-block', width: 24, height: 24, marginRight: 8, borderRadius: 4, fontWeight: 700, color: '#000', textAlign: 'center', lineHeight: '24px', fontSize: 11 }}>M</span>
              <div>
                <div style={{ fontWeight: 700, color: '#856404' }}>Moderate Risk (40-74%)</div>
                <div style={{ fontSize: 11, color: '#856404' }}>Avoid low-lying areas, monitor closely</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: 6, background: '#f8d7da', borderRadius: 4 }}>
              <span style={{ background: '#dc3545', display: 'inline-block', width: 24, height: 24, marginRight: 8, borderRadius: 4, fontWeight: 700, color: 'white', textAlign: 'center', lineHeight: '24px', fontSize: 11 }}>H</span>
              <div>
                <div style={{ fontWeight: 700, color: '#721c24' }}>High Risk (75-100%)</div>
                <div style={{ fontSize: 11, color: '#721c24' }}>Move to higher ground immediately</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#dc3545' }}>Safety Guidelines</h3>
          <div style={{ fontSize: 12, background: '#fff3cd', padding: 10, borderRadius: 6, border: '1px solid #ffc107' }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>High risk areas: Move to higher ground immediately</li>
              <li style={{ marginBottom: 4 }}>Avoid riverbanks, low-lying areas, and bridges during floods</li>
              <li style={{ marginBottom: 4 }}>Never attempt to cross flooded roads or walk through flowing water</li>
              <li style={{ marginBottom: 4 }}>Follow local authority instructions and emergency broadcasts</li>
              <li>Keep emergency supplies ready: water, food, first aid, radio</li>
            </ul>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0066cc' }}>High Risk Areas (Top 10)</h3>
          {scanResults.length === 0 && <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>No scan results yet. Click "Scan Area" to analyze visible regions.</div>}
          <ul style={{ paddingLeft: 0, listStyle: 'none', marginTop: 8 }}>
            {scanResults.map((s, idx) => {
              const props = s.feature?.props || {};
              const areaName = props?.TA3_name || props?.ta3_name || props?.TA || props?.ta || props?.ta_name || props?.name || props?.name_en || `Area ${idx + 1}`;
              const districtName = props?.DISTRICT || props?.district || '';

              // Prioritize enriched risk calculation over database and fallback values
              const enr = s.enriched ?? s;
              const enrichedRisk = (enr && typeof enr.risk !== 'undefined' && enr.risk !== null) ? normalizeRisk(enr.risk) : null;
              const serverRiskRaw = s.feature && s.feature.props ? (s.feature.props.risk_score ?? s.feature.props.risk ?? null) : null;
              const serverRisk = typeof serverRiskRaw !== 'undefined' && serverRiskRaw !== null ? normalizeRisk(serverRiskRaw) : null;
              const fallbackRisk = (typeof s.risk !== 'undefined' && s.risk !== null) ? normalizeRisk(s.risk) : null;

              // Priority: enriched (calculated with rainfall) > server database > fallback
              const displayRisk = enrichedRisk !== null ? enrichedRisk : (serverRisk !== null ? serverRisk : fallbackRisk);
              const riskColor = displayRisk === null ? '#999' : displayRisk >= 75 ? '#dc3545' : displayRisk >= 40 ? '#ffc107' : '#28a745';

              const displayRain = (enr && typeof enr.rainfall !== 'undefined' && enr.rainfall !== null) ? enr.rainfall : (s.rainfall ?? 'n/a');
              const displayDist = (enr && typeof enr.dist_m !== 'undefined' && enr.dist_m !== null) ? enr.dist_m : (s.dist_m ?? 0);
              const displayPred = enr && (enr.predictedFloodDate || enr.predicted) ? (enr.predictedFloodDate || enr.predicted) : s.predictedFloodDate;
              const displayAdvice = enr && enr.advice ? enr.advice : s.advice;

              return (
                <li key={idx} style={{ marginBottom: 10, padding: 10, background: 'white', borderRadius: 6, borderLeft: `4px solid ${riskColor}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{areaName}</div>
                      {districtName && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{districtName}</div>}
                    </div>
                    <button
                      onClick={() => {
                        const feature = s.feature;
                        const f = feature && feature.props && feature.props.__originalFeature ? feature.props.__originalFeature : null;
                        const bounds = f ? getFeatureBounds(f) : null;
                        if (bounds && mapRef.current && typeof mapRef.current.fitBounds === 'function') {
                          mapRef.current.fitBounds(bounds as any);
                        } else {
                          const c = s.feature.geom;
                          if (c && mapRef.current && typeof mapRef.current.flyTo === 'function') {
                            const [lng, lat] = c;
                            mapRef.current.flyTo([lat, lng], 12);
                          }
                        }
                      }}
                      style={{ padding: '6px 12px', fontSize: 12, background: '#0066cc', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >View</button>
                  </div>
                  <div style={{ fontSize: 12, padding: 8, background: '#f8f9fa', borderRadius: 4 }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: riskColor }}>Risk Score: {displayRisk ?? 'N/A'}%</span>
                      {enrichedRisk !== null && <span style={{ fontSize: 10, marginLeft: 6, color: '#0066cc' }}>(Live Calculated)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>
                      Rainfall: <strong>{typeof displayRain === 'number' ? displayRain.toFixed(1) : displayRain} mm</strong> •
                      River Distance: <strong>{Math.round(displayDist ?? 0)} m</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#777', marginTop: 4, paddingTop: 4, borderTop: '1px solid #dee2e6' }}>
                      Predicted Flood: <strong>{formatDate(displayPred)}</strong>
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, padding: 6, background: riskColor === '#dc3545' ? '#f8d7da' : riskColor === '#ffc107' ? '#fff3cd' : '#d4edda', borderRadius: 4, color: riskColor === '#dc3545' ? '#721c24' : riskColor === '#ffc107' ? '#856404' : '#155724' }}>
                      <strong>Action:</strong> {displayAdvice}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

      </div>


      {/* Right Side Panel Container */}
      <div style={{ position: "absolute", right: 10, top: 10, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', pointerEvents: 'none' }}>

        {/* Rainfall Updates Panel */}
        {rainfallUpdates.length > 0 && (
          <div style={{ pointerEvents: 'auto', background: 'rgba(255,255,255,0.95)', padding: 12, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: 280, border: '1px solid #cce5ff' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 700, color: '#0066cc', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: 6, fontSize: 18 }}>🌧️</span>
              <span>Live Rainfall Updates</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, background: '#e6f2ff', padding: '2px 6px', borderRadius: 10, color: '#0066cc' }}>LIVE</span>
            </h3>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, maxHeight: 300, overflowY: 'auto' }}>
              {rainfallUpdates.map((s, idx) => {
                const props = s.feature?.props || {};
                const areaName = props?.TA3_name || props?.ta3_name || props?.TA || props?.ta || props?.name || `Area ${idx + 1}`;
                const districtName = props?.DISTRICT || props?.district || '';
                const rain = s.enriched?.rainfall || s.rainfall || 0;

                let bgColor = '#f0f7ff';
                let borderColor = '#cce5ff';
                if (rain > 50) { bgColor = '#fff0f0'; borderColor = '#ffc9c9'; }
                else if (rain > 20) { bgColor = '#fff8e1'; borderColor = '#ffeeba'; }

                return (
                  <li key={`rain-${idx}`} style={{ marginBottom: 6, padding: 8, background: bgColor, borderRadius: 8, border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#333' }}>{areaName}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>{districtName}</div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0066cc' }}>{rain.toFixed(1)}</div>
                      <div style={{ fontSize: 9, color: '#666' }}>mm</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Risk Info Popup */}
        {riskInfo && (
          <div style={{ pointerEvents: 'auto', background: "white", padding: 16, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: 280 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#0066cc' }}>Location Risk Analysis</h3>
            <div style={{ fontSize: 13 }}>
              <div style={{ marginBottom: 8, padding: 10, background: '#f8f9fa', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Risk Score</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: riskInfo.risk >= 75 ? '#dc3545' : riskInfo.risk >= 40 ? '#ffc107' : '#28a745' }}>
                  {riskInfo.risk ?? "N/A"}%
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#666' }}>Distance to Nearest River</div>
                <div style={{ fontWeight: 700 }}>{riskInfo.dist_m ? `${Math.round(riskInfo.dist_m)} meters` : "N/A"}</div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#666' }}>Current Rainfall</div>
                <div style={{ fontWeight: 700 }}>{riskInfo.rainfall ? `${riskInfo.rainfall.toFixed(1)} mm` : "0 mm"}</div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#666' }}>Predicted Flood Date</div>
                <div style={{ fontWeight: 700 }}>{formatDate(riskInfo.predictedFloodDate)}</div>
              </div>
              <div style={{ marginTop: 10, padding: 8, background: riskInfo.risk >= 75 ? '#f8d7da' : riskInfo.risk >= 40 ? '#fff3cd' : '#d4edda', borderRadius: 6, fontSize: 12, color: riskInfo.risk >= 75 ? '#721c24' : riskInfo.risk >= 40 ? '#856404' : '#155724' }}>
                <strong>Recommendation:</strong><br />
                {riskInfo.risk >= 75 ? 'High risk — Evacuate to higher ground immediately' : riskInfo.risk >= 40 ? 'Moderate risk — Avoid low-lying areas, monitor situation' : 'Low risk — Stay informed and prepared'}
              </div>
            </div>
          </div>
        )}
      </div>

      <MapContainer
        center={[-13.9626, 33.75]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

        {isFeatureCollection(riversGeo) && (
          <GeoJSON data={riversGeo} style={riversStyle} onEachFeature={(f, layer) => layer.on({ click: onFeatureClick })} />
        )}

        {isFeatureCollection(roadsGeo) && (
          <GeoJSON data={roadsGeo} style={roadsStyle} onEachFeature={(f, layer) => layer.on({ click: onFeatureClick })} />
        )}

        {isFeatureCollection(districtsGeo) && (
          <GeoJSON data={districtsGeo} style={districtStyle} onEachFeature={(f, layer) => layer.on({ click: onFeatureClick })} />
        )}

        {rainfallData.slice(0, 200).map((p, i) => (
          <CircleMarker
            key={`r${i}`}
            center={[p.lat, p.lng]}
            radius={Math.max(p.intensity * 4, 2)}
            pathOptions={{ color: p.intensity <= 0.1 ? "#00ff00" : p.intensity <= 2 ? "#ffff00" : p.intensity <= 5 ? "#ffa500" : p.intensity <= 10 ? "#ff4500" : "#ff0000", fillOpacity: 0.4 }}
          >
            <Popup>
              {`${p.name || `Lat ${p.lat.toFixed(2)}, Lng ${p.lng.toFixed(2)}`}<br/>Rainfall: ${p.intensity.toFixed(1)} mm`}
            </Popup>
          </CircleMarker>
        ))}

        <Legend />
        <MapClickHandler onClick={onMapClick} />
      </MapContainer>


      <ChatComponent contextData={{ scanResults, rainfallUpdates, riskInfo }} />
    </div>
  );
};

export default MapComponent;