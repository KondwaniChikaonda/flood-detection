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

// small helper control components
const Legend: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const div = L.DomUtil.create("div", "info legend");
    div.style.background = "white";
    div.style.padding = "8px";
    div.style.borderRadius = "5px";
    div.style.color = "black";
    div.style.fontSize = "12px";

    const grades = [0, 0.1, 2, 5, 10];
    const colors = ["#00ff00", "#ffff00", "#ffa500", "#ff4500", "#ff0000"];

    div.innerHTML =
      `<b>Rainfall (mm)</b><br>` +
      grades
        .map((from, i) => {
          const to = grades[i + 1] || "+";
          return `<i style="background:${colors[i]}; width: 18px; height: 18px; display:inline-block; margin-right:5px;"></i> ${from} - ${to}`;
        })
        .join("<br>");

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
  const [searchLayer, setSearchLayer] = useState<'districts'|'roads'|'rivers'>('districts');
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [riskInfo, setRiskInfo] = useState<any | null>(null);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const mapRef = useRef<any>(null);

  // load rainfall (center) and generate sample points (keeps your previous UX)
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

  // load geo layers
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

  const onMapClick = async (lat: number, lng: number) => {
    // use latest rainfall at nearest point
    const nearestRain = rainfallData.reduce((acc, p) => {
      const d = Math.hypot(p.lat - lat, p.lng - lng);
      return d < acc.d ? { p, d } : acc;
    }, { p: rainfallData[0], d: Infinity } as any);

    const rainfall = nearestRain?.p?.intensity || 0;

    try {
      const res = await fetch(`/api/risk?lat=${lat}&lng=${lng}&rainfall=${rainfall}`);
  const data = await res.json();
  // attach date info: current date and a deterministic predicted flood date based on risk
  const now = new Date();
  const predicted = predictFloodDateFromRisk(data.risk, now);
  setRiskInfo({ ...data, currentDate: now.toISOString(), predictedFloodDate: predicted.toISOString() });
    } catch (err) {
      console.error("risk api failed", err);
    }
  };

  const onSearch = async () => {
    if (!searchQ) return;
    try {
  const res = await fetch(`/api/search?q=${encodeURIComponent(searchQ)}&layer=${encodeURIComponent(searchLayer)}`);
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
          } else {
            console.warn('search result has no usable centroid', feat);
          }
        }
      }

      // enrich top search results with risk and advice
      try {
        const top = data.features.slice(0, 8);
        const enriched = await Promise.all(
          top.map(async (f: any) => {
            const c = getFeatureCenter(f);
            if (!c) return { feature: f, risk: null, advice: 'No location available' };
            const [lng, lat] = c;
            // pick nearest rainfall
            const nearestRain = rainfallData.reduce((acc, p) => {
              const d = Math.hypot(p.lat - lat, p.lng - lng);
              return d < acc.d ? { p, d } : acc;
            }, { p: rainfallData[0], d: Infinity } as any);
            const rainfall = nearestRain?.p?.intensity || 0;
            try {
              const res = await fetch(`/api/risk?lat=${lat}&lng=${lng}&rainfall=${rainfall}`);
              const r = await res.json();
              let advice = 'No immediate action';
              if (r.risk >= 75) advice = 'High risk — move to higher ground and follow local authority orders';
              else if (r.risk >= 40) advice = 'Moderate risk — avoid low-lying areas and monitor updates';
              else advice = 'Low risk — stay informed';
              const now = new Date();
              const predicted = predictFloodDateFromRisk(r.risk, now);
              return { feature: f, risk: r.risk, advice, currentDate: now.toISOString(), predictedFloodDate: predicted.toISOString() };
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

  const getFeatureBounds = (feat: any): [[number, number],[number, number]] | null => {
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

  // format ISO string or Date to readable local string
  const formatDate = (isoOrDate?: string | Date | null) => {
    if (!isoOrDate) return 'n/a';
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(d.getTime())) return 'n/a';
    return d.toLocaleString();
  };

  // deterministic predicted flood date based on risk score
  // - Higher risk => sooner predicted date. This is a simple heuristic for UI only.
  // Inputs: risk numeric 0-100, base Date (now)
  const predictFloodDateFromRisk = (risk: number | null | undefined, baseDate: Date = new Date()) => {
    const b = baseDate || new Date();
    const r = typeof risk === 'number' && !isNaN(risk) ? Math.max(0, Math.min(100, risk)) : 0;
    // map risk to days: 0 -> +14 days, 25 -> +10, 50 -> +5, 75 -> +2, 100 -> +1
    const days = r >= 75 ? 1 : r >= 50 ? 2 : r >= 25 ? 5 : r >= 10 ? 10 : 14;
    const predicted = new Date(b.getTime());
    predicted.setDate(predicted.getDate() + days);
    return predicted;
  };

  const scanVisibleArea = async () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();

    // gather candidate features from districts & roads & rivers
    const candidates: Array<{ id: string; geom: any; type: string; props: any }> = [];

    const addFeatures = (fc: any, type: string) => {
      if (!fc || !fc.features) return;
      for (let i = 0; i < fc.features.length; i++) {
        const f = fc.features[i];
        // compute centroid approx from geometry
        const geom = f.geometry;
        let coord: [number, number] | null = null;
        try {
          if (geom.type === 'Polygon') coord = geom.coordinates[0][0];
          else if (geom.type === 'MultiPolygon') coord = geom.coordinates[0][0][0];
          else if (geom.type === 'LineString') coord = geom.coordinates[Math.floor(geom.coordinates.length/2)];
          else if (geom.type === 'Point') coord = geom.coordinates;
        } catch (e) {
          coord = null;
        }
        if (coord) {
          const lng = coord[0];
          const lat = coord[1];
            if (bounds.contains([lat, lng])) {
            candidates.push({ id: f.properties?.id || `${type}-${i}`, geom: coord, type, props: { ...f.properties, __originalFeature: f } });
          }
        }
        if (candidates.length > 200) break;
      }
    };

    addFeatures(districtsGeo, 'district');
    addFeatures(roadsGeo, 'road');
    addFeatures(riversGeo, 'river');

    // request risk for candidates (batch up to 80 to avoid flooding endpoint)
    const toCheck = candidates.slice(0, 80);
    const results: any[] = [];
    for (const c of toCheck) {
      const [lng, lat] = c.geom;
      // pick nearest rainfall sample
      const nearestRain = rainfallData.reduce((acc, p) => {
        const d = Math.hypot(p.lat - lat, p.lng - lng);
        return d < acc.d ? { p, d } : acc;
      }, { p: rainfallData[0], d: Infinity } as any);
      const rainfall = nearestRain?.p?.intensity || 0;
      try {
        const res = await fetch(`/api/risk?lat=${lat}&lng=${lng}&rainfall=${rainfall}`);
  const data = await res.json();
  // compute predicted date for client-side display
  const now = new Date();
  const predicted = predictFloodDateFromRisk(data.risk, now);
  results.push({ feature: c, risk: data.risk, dist_m: data.dist_m, rainfall: data.rainfall, currentDate: now.toISOString(), predictedFloodDate: predicted.toISOString() });
      } catch (e) {
        console.error('scan risk error', e);
      }
    }

    // sort descending risk and show top 20
    results.sort((a, b) => (b.risk || 0) - (a.risk || 0));
    setScanResults(results.slice(0, 20));
  };

  // basic feature style
  const riversStyle = { color: "#1e88e5", weight: 2 };
  const roadsStyle = { color: "#444", weight: 1 };
  const districtStyle = { color: "#2e7d32", weight: 1, fillOpacity: 0.05 };

  const isFeatureCollection = (g: any) => {
    return (
      g && typeof g === "object" && g.type === "FeatureCollection" && Array.isArray(g.features)
    );
  };

  // helper to bind popup with risk info when a feature is clicked
  const onFeatureClick = async (e: any) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    await onMapClick(lat, lng);
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
  <div style={{ position: "absolute", zIndex: 600, left: 10, top: 10, width: 320, maxHeight: '80vh', overflow: 'auto', background: 'rgba(255,255,255,0.95)', padding: 12, borderRadius: 8, color: '#000000', fontWeight: 600 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search district or area"
                style={{ padding: 8, flex: 1 }}
              />
              <select value={searchLayer} onChange={(e) => setSearchLayer(e.target.value as any)} style={{ padding: 8 }}>
                <option value="districts">Districts</option>
                <option value="roads">Roads</option>
                <option value="rivers">Rivers</option>
              </select>
            </div>
            <div style={{ display: 'flex', marginTop: 8 }}>
              <button onClick={onSearch} style={{ flex: 1, padding: 8 }}>Search</button>
              <button onClick={scanVisibleArea} style={{ flex: 1, marginLeft: 8, padding: 8 }}>Scan visible</button>
            </div>

            {/* Search results */}
            {searchResults?.features?.length ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Search results</div>
                <ul style={{ maxHeight: 180, overflow: 'auto', paddingLeft: 12 }}>
                  {searchResults.features.map((f: any, idx: number) => {
                    const name = f.properties?.ta_name || f.properties?.district || f.properties?.name || f.properties?.name_en || `Feature ${idx}`;
                    const area = f.properties?.area || f.properties?.perimeter || '';
                    const osm = f.properties?.osm_id || f.properties?.gid || '';
                    const enriched = searchResults.enriched && searchResults.enriched.find((e: any) => e.feature === f);
                    return (
                      <li key={idx} style={{ marginBottom: 6 }}>
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
                          style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', color: '#000', fontWeight: 700 }}
                        >
                          {name}
                        </button>
                        <div style={{ fontSize: 12, color: '#333' }}>{area ? `Area: ${area}` : ''} {osm ? ` • OSM: ${osm}` : ''}</div>
                        {enriched && (
                          <div style={{ fontSize: 12, marginTop: 4 }}><strong>Risk:</strong> {enriched.risk ?? 'n/a'} — <em>{enriched.advice}</em></div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#000' }}>Key</div>
          <div style={{ fontSize: 12, marginTop: 6, color: '#000' }}>
            <div><span style={{ background: '#1e88e5', display: 'inline-block', width: 16, height: 8, marginRight: 6 }}></span> Rivers</div>
            <div><span style={{ background: '#444', display: 'inline-block', width: 16, height: 8, marginRight: 6 }}></span> Roads</div>
            <div><span style={{ background: '#ff4500', display: 'inline-block', width: 16, height: 8, marginRight: 6 }}></span> High rainfall marker</div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#000' }}>Advice</div>
          <div style={{ fontSize: 12, marginTop: 6, color: '#000' }}>
            - If risk is high, avoid low-lying areas, riverbanks and bridges; seek higher ground.
            <br />- Follow local authority instructions and monitor updates.
            <br />- If driving, do not attempt to cross flooded roads.
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#000' }}>Scan results (top risks)</div>
          {scanResults.length === 0 && <div style={{ fontSize: 12, marginTop: 6, color: '#000' }}>No items scanned yet.</div>}
          <ul style={{ paddingLeft: 12, marginTop: 6 }}>
            {scanResults.map((s, idx) => (
              <li key={idx} style={{ marginBottom: 8, color: '#000' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800 }}>{s.feature.type} {s.feature.props?.ta_name || s.feature.props?.district || s.feature.props?.name || ''}</div>
                  <button
                    onClick={() => {
                      // try to fit bounds to the underlying feature if available
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
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  >Go</button>
                </div>
                <div style={{ fontSize: 12 }}>Risk: <span style={{ fontWeight: 700 }}>{s.risk}</span> — Rainfall: {s.rainfall} mm — Dist to river: {Math.round(s.dist_m ?? 0)} m</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <MapContainer
        center={[-13.9626, 33.75]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        // whenCreated provides the actual Leaflet Map instance
        // @ts-ignore
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance as any;
        }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

        {isFeatureCollection(riversGeo) ? (
          <GeoJSON data={riversGeo} style={riversStyle} onEachFeature={(f, layer) => layer.on({ click: onFeatureClick })} />
        ) : (
          riversGeo && console.warn('Invalid rivers GeoJSON', riversGeo)
        )}

        {isFeatureCollection(roadsGeo) ? (
          <GeoJSON data={roadsGeo} style={roadsStyle} onEachFeature={(f, layer) => layer.on({ click: onFeatureClick })} />
        ) : (
          roadsGeo && console.warn('Invalid roads GeoJSON', roadsGeo)
        )}

        {isFeatureCollection(districtsGeo) ? (
          <GeoJSON data={districtsGeo} style={districtStyle} onEachFeature={(f, layer) => layer.on({ click: onFeatureClick })} />
        ) : (
          districtsGeo && console.warn('Invalid districts GeoJSON', districtsGeo)
        )}

        {/* Rainfall markers */}
        {rainfallData.slice(0, 200).map((p, i) => (
          <CircleMarker
            key={`r${i}`}
            center={[p.lat, p.lng]}
            radius={Math.max(p.intensity * 4, 2)}
            pathOptions={{ color: p.intensity <= 0.1 ? "#ffff00" : p.intensity <= 2 ? "#ffa500" : "#ff4500", fillOpacity: 0.4 }}
          >
            <Popup>
              {`${p.name || `Lat ${p.lat.toFixed(2)}, Lng ${p.lng.toFixed(2)}`}<br/>Rainfall: ${p.intensity.toFixed(1)} mm`}
            </Popup>
          </CircleMarker>
        ))}

        <Legend />
        <MapClickHandler onClick={onMapClick} />
      </MapContainer>

      {riskInfo && (
        <div style={{ position: "absolute", right: 10, top: 10, zIndex: 450, background: "white", padding: 12, borderRadius: 8 }}>
          <div><strong>Risk:</strong> {riskInfo.risk ?? "n/a"}</div>
          <div><strong>Distance to river (m):</strong> {riskInfo.dist_m ?? "n/a"}</div>
          <div><strong>Rainfall:</strong> {riskInfo.rainfall ?? 0} mm</div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
