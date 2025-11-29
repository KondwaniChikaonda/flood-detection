import { NextResponse } from 'next/server';
import { connect } from '../../lib/db';

export async function GET() {
  const result = await connect();
  if (result.ok) {
    return NextResponse.json({ status: 'connected' });
  }
  return NextResponse.json({ status: 'error', error: result.error }, { status: 500 });
}
