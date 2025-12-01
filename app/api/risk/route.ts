import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const rainfall = parseFloat(url.searchParams.get('rainfall') || '0');

  // support search-style params: q, layer, district, limit
  const qparam = url.searchParams.get('q') || '';
  const layer = url.searchParams.get('layer') || '';
  const districtFilter = url.searchParams.get('district') || '';
  const limitParam = url.searchParams.get('limit') || '';

  // If search-style request (layer or q present), reuse search logic and return FeatureCollection
  if (layer || qparam) {
    // allow empty query when asking for default top areas
    if (!qparam && layer !== 'areas') return NextResponse.json({ features: [] });
    try {
      const LAYER_TABLES: Record<string, string> = {
        districts: 'districts_enum',
        roads: 'roads',
        rivers: 'rivers',
        areas: 'districts_enum',
      };
      const table = LAYER_TABLES[layer] || LAYER_TABLES.districts;

      let whereClause = '';
      if (layer === 'districts') {
        whereClause = `("DISTRICT" ILIKE $1 OR "TA" ILIKE $1 OR "TA3_name" ILIKE $1)`;
      } else if (layer === 'areas') {
        whereClause = `("TA3_name" ILIKE $1 OR "DISTRICT" ILIKE $1)`;
        if (districtFilter) whereClause += ` AND "DISTRICT" ILIKE $2`;
      } else if (layer === 'roads') {
        whereClause = `(name ILIKE $1 OR name_en ILIKE $1 OR highway ILIKE $1)`;
      } else if (layer === 'rivers') {
        whereClause = `(name ILIKE $1 OR name_en ILIKE $1 OR waterway ILIKE $1)`;
      } else {
        whereClause = `(to_jsonb(t)::text ILIKE $1)`;
      }

      const limit = limitParam ? parseInt(limitParam, 10) || 5 : 5;
      let sql: string;
      let params: any[];
      if (layer === 'areas' && !qparam) {
        sql = `
          SELECT id, ST_AsGeoJSON(geom)::json AS geom_geojson, to_jsonb(t) - 'geom' AS props
          FROM (
            SELECT * FROM ${table}
            WHERE geom IS NOT NULL
            ORDER BY "risk_score" DESC NULLS LAST
            LIMIT ${limit}
          ) t;
        `;
        params = [];
      } else {
        const orderByRisk = table === 'districts_enum' ? `ORDER BY "risk_score" DESC NULLS LAST` : '';
        sql = `
          SELECT id, ST_AsGeoJSON(geom)::json AS geom_geojson, to_jsonb(t) - 'geom' AS props
          FROM (
            SELECT * FROM ${table}
            WHERE ${whereClause}
            AND geom IS NOT NULL
            ${orderByRisk}
            LIMIT 100
          ) t;
        `;
        params = districtFilter && layer === 'areas' ? [`%${qparam}%`, `%${districtFilter}%`] : [`%${qparam}%`];
      }

      const res = await pool.query(sql, params);
      const features = res.rows
        .map((r: any) => {
          const geom = r.geom_geojson;
          if (!geom || !geom.type) return null;
          const props = r.props || {};
          // include risk from stored risk_score if available
          const riskRaw = props?.risk_score ?? null;
          const risk = typeof riskRaw === 'number' ? Math.max(0, Math.min(100, Math.round(riskRaw))) : null;
          props.risk = risk;
          return { type: 'Feature', geometry: geom, properties: props };
        })
        .filter(Boolean);

      return NextResponse.json({ type: 'FeatureCollection', features });
    } catch (err) {
      console.error('[risk-search] error', err);
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // fallback: single-point risk calculation using lat/lng
  const latNum = parseFloat(lat || '0');
  const lngNum = parseFloat(lng || '0');
  if (!latNum || !lngNum) return NextResponse.json({ error: 'lat,lng required' }, { status: 400 });

  try {
    const q = `
      SELECT id, ST_DistanceSphere(ST_Transform(geom,4326), ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS dist_m, ST_Transform(geom,4326) AS geom4326
      FROM rivers
      WHERE geom IS NOT NULL
      ORDER BY ST_Transform(geom,4326) <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1;
    `;

    const res = await pool.query(q, [lngNum, latNum]);
    const nearest = res.rows[0];
    const dist = nearest ? nearest.dist_m : null;

    // risk score 0-100 (base by proximity then scaled by rainfall)
    let base = 0;
    if (dist === null) base = 10;
    else if (dist < 50) base = 90;
    else if (dist < 200) base = 70;
    else if (dist < 500) base = 50;
    else if (dist < 2000) base = 25;
    else base = 5;

    // New formula: Base risk from proximity + significant rainfall impact
    // If rainfall is high (>10mm), it should add substantial risk even if far from river
    const rainfallRisk = Math.min(50, rainfall * 5); // Cap rainfall contribution at 50%
    const rawRisk = Math.round(base * (1 + rainfall / 20) + rainfallRisk);
    const risk = Math.max(0, Math.min(100, rawRisk));

    // attempt to find the containing TA3 area from districts_enum
    let nearestArea: any = null;
    try {
      const aSql = `
        SELECT id, "TA3_name", "DISTRICT", "risk_score"
        FROM districts_enum
        WHERE geom IS NOT NULL AND ST_Intersects(ST_Transform(geom,4326), ST_SetSRID(ST_MakePoint($1, $2), 4326))
        LIMIT 1;
      `;
      const aRes = await pool.query(aSql, [lngNum, latNum]);
      if (aRes.rows && aRes.rows.length) {
        const ar = aRes.rows[0];
        nearestArea = { id: ar.id, TA3_name: ar.TA3_name || ar.ta3_name, DISTRICT: ar.DISTRICT || ar.district, risk_score: ar.risk_score };
      }
    } catch (e) {
      console.warn('[risk] nearest area lookup failed', e);
    }

    return NextResponse.json({ lat: latNum, lng: lngNum, dist_m: dist, rainfall, risk, nearestArea });
  } catch (err) {
    console.error('[risk] error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
