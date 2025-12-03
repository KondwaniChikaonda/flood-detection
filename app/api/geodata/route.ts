import { NextResponse } from 'next/server';
import pool, { connect } from '../../lib/db';

const ALLOWED = new Set(['rivers', 'roads', 'districts']);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const layer = url.searchParams.get('layer') || 'rivers';

  if (!ALLOWED.has(layer)) {
    return NextResponse.json({ error: 'Invalid layer' }, { status: 400 });
  }

  // Bounding box roughly covering Malawi (expanded to include southern districts like Chikwawa/Thyolo/Nsanje)
  // Source bbox expanded slightly to account for data inaccuracies
  const minLng = 32.0;
  const minLat = -17.5;
  const maxLng = 36.5;
  const maxLat = -8.5;

  try {
    const q = `
      SELECT id,
             ST_AsGeoJSON(ST_Transform(geom,4326))::json AS geom_geojson,
             to_jsonb(t) - 'geom' AS props
      FROM (
        SELECT * FROM ${layer}
        WHERE geom IS NOT NULL
          AND ST_Intersects(
            ST_Transform(geom,4326),
            ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)
          )
        LIMIT 2000
      ) t;
    `;

    const res = await pool.query(q);

    const features = res.rows
      .map((r: any) => {
        const geom = r.geom_geojson;
        if (!geom || !geom.type) return null;
        return {
          type: 'Feature',
          geometry: geom,
          properties: r.props || {},
        };
      })
      .filter(Boolean);

    return NextResponse.json({ type: 'FeatureCollection', features });
  } catch (err) {
    console.error('[geodata] error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
