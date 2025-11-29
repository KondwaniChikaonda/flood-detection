import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET() {
  const minLng = 32.0;
  const minLat = -17.5;
  const maxLng = 36.5;
  const maxLat = -8.5;

  try {
    const layers = ['rivers','roads','districts'];
    const out: any = {};
    for (const layer of layers) {
      const q = `SELECT count(*) FROM ${layer} WHERE geom IS NOT NULL AND ST_Intersects(ST_Transform(geom,4326), ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`;
      const r = await pool.query(q);
      out[layer] = Number(r.rows[0].count);
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error('[geodata debug] error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
