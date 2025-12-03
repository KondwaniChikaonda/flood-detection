import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get('lat') || '0');
  const lng = parseFloat(url.searchParams.get('lng') || '0');
  const rainfall = parseFloat(url.searchParams.get('rainfall') || '0');

  if (!lat || !lng) return NextResponse.json({ error: 'lat,lng required' }, { status: 400 });

  try {
    const q = `
      SELECT id, ST_DistanceSphere(ST_Transform(geom,4326), ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS dist_m
      FROM rivers
      WHERE geom IS NOT NULL
      ORDER BY ST_Transform(geom,4326) <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1;
    `;

    const res = await pool.query(q, [lng, lat]);
    const nearest = res.rows[0];
    const dist = nearest ? nearest.dist_m : null;

    // risk score 0-100
    let base = 0;
    if (dist === null) base = 10;
    else if (dist < 50) base = 90;
    else if (dist < 200) base = 70;
    else if (dist < 500) base = 50;
    else if (dist < 2000) base = 25;
    else base = 5;

    const risk = Math.min(100, Math.round(base * (1 + rainfall / 10)));

    return NextResponse.json({ lat, lng, dist_m: dist, rainfall, risk });
  } catch (err) {
    console.error('[risk] error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
