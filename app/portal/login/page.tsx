"use client";

import React, { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: any) => {
    e.preventDefault();
    setError(null);
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (res.ok) {
        setMsg('Login successful — redirecting');
        setTimeout(() => window.location.href = '/portal', 700);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (e) {
      setError('Login request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, system-ui, -apple-system, Roboto, sans-serif', background: '#fff' }}>
      <div style={{ width: 420, padding: 28, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.06)', background: '#fff', color: '#000' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#000" strokeWidth="1.2" /><path d="M9 11c1-1 3-1 4 0" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div>
            <h2 style={{ margin: 0 }}>Disaster Portal</h2>
            <div style={{ fontSize: 13, color: '#444' }}>Secure sign in</div>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#000' }}>Email</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e6e6e6', padding: 8, borderRadius: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8l9 6 9-6" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><rect x="3" y="5" width="18" height="14" rx="2" stroke="#000" strokeWidth="1.2" /></svg>
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#000' }}>Password</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e6e6e6', padding: 8, borderRadius: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="10" rx="2" stroke="#000" strokeWidth="1.2" /><path d="M7 11V8a5 5 0 0110 0v3" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="submit" disabled={loading} style={{ padding: '10px 14px', background: '#000', color: 'white', border: 'none', borderRadius: 8, flex: 1 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" onClick={() => { setEmail(''); setPassword(''); setMsg(''); setError(null); }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e6e6e6', background: '#fff', color: '#000' }}>Forgot Password?</button>
          </div>
        </form>

        <div style={{ marginTop: 12 }}>
          {error && <div style={{ color: '#b00020', fontWeight: 600 }}>{error}</div>}
          {msg && !error && <div style={{ color: '#0a0', fontWeight: 600 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
