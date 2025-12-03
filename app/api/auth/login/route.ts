import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    const res = await pool.query('SELECT id, name, email, password_hash, role FROM users WHERE email = $1 LIMIT 1', [email]);
    if (!res.rows.length) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const user = res.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });


    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (e) {
    console.error('/api/auth/login error', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
