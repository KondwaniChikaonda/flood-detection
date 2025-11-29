import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const layer = url.searchParams.get('layer') || 'districts';

  if (!q) return NextResponse.json({ features: [] });

  try {
    // choose searchable columns per layer to avoid missing column errors
    let whereClause = '';
    if (layer === 'districts') {
      whereClause = `(ta_name ILIKE $1 OR district ILIKE $1)`;
    } else if (layer === 'roads') {
      whereClause = `(name ILIKE $1 OR name_en ILIKE $1 OR highway ILIKE $1)`;
    } else if (layer === 'rivers') {
      whereClause = `(name ILIKE $1 OR name_en ILIKE $1 OR waterway ILIKE $1)`;
    } else {
      whereClause = `(to_jsonb(t)::text ILIKE $1)`; // fallback: search any text
    }

    const sql = `
      SELECT id, ST_AsGeoJSON(geom)::json AS geom_geojson, to_jsonb(t) - 'geom' AS props
      FROM (
        SELECT * FROM ${layer}
        WHERE ${whereClause}
        AND geom IS NOT NULL
        LIMIT 50
      ) t;
    `;

    const res = await pool.query(sql, [`%${q}%`]);
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
