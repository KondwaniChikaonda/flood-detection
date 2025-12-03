import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const layer = url.searchParams.get('layer') || 'districts';
  const districtFilter = url.searchParams.get('district') || '';
  const limitParam = url.searchParams.get('limit') || '';

  // allow empty query when asking for default top areas
  if (!q && layer !== 'areas') return NextResponse.json({ features: [] });

  try {
    // whitelist allowed tables to avoid SQL injection
    const LAYER_TABLES: Record<string, string> = {
      districts: 'districts_enum',
      roads: 'roads',
      rivers: 'rivers',
  areas: 'districts_enum' // areas are stored in the districts_enum table (TA3_name + DISTRICT)
    };

    const table = LAYER_TABLES[layer] || LAYER_TABLES.districts;

    // choose searchable columns per layer to avoid missing column errors
    let whereClause = '';
    if (layer === 'districts') {
      // search district-level names and also allow TA3_name and TA fields (use quoted names)
      whereClause = `("DISTRICT" ILIKE $1 OR "TA" ILIKE $1 OR "TA3_name" ILIKE $1)`;
    } else if (layer === 'areas') {
      // TA3_name contains smaller area names; allow optional district exact/like filter
      whereClause = `("TA3_name" ILIKE $1 OR "DISTRICT" ILIKE $1)`;
      if (districtFilter) whereClause += ` AND "DISTRICT" ILIKE $2`;
    } else if (layer === 'roads') {
      whereClause = `(name ILIKE $1 OR name_en ILIKE $1 OR highway ILIKE $1)`;
    } else if (layer === 'rivers') {
      whereClause = `(name ILIKE $1 OR name_en ILIKE $1 OR waterway ILIKE $1)`;
    } else {
      whereClause = `(to_jsonb(t)::text ILIKE $1)`; // fallback: search any text
    }

    // If asking for default areas (no q) return top 5 by risk_score
    let sql: string;
    let params: any[];
  const limit = limitParam ? parseInt(limitParam, 10) || 5 : 5;
  if (layer === 'areas' && !q) {
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
      params = districtFilter && layer === 'areas' ? [`%${q}%`, `%${districtFilter}%`] : [`%${q}%`];
    }

    const res = await pool.query(sql, params);
    const features = res.rows
      .map((r: any) => {
        const geom = r.geom_geojson;
        if (!geom || !geom.type) return null;
        return { type: 'Feature', geometry: geom, properties: r.props || {} };
      })
      .filter(Boolean);

    return NextResponse.json({ type: 'FeatureCollection', features });
  } catch (err) {
    console.error('[search] error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
