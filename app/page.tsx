"use client";

import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ fontFamily: 'Inter, system-ui, -apple-system, Roboto, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
      <div style={{ width: 980, background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 10px 20px rgba(0,0,0,0.06)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: '#000' }}>FloodDetect — Malawi</h1>
            <p style={{ margin: 0, color: '#000', marginTop: 6 }}>Live weather & flood risk monitoring and alerts.</p>
          </div>
          <nav>
            <Link href="/portal/login"><button style={{ padding: '8px 12px', borderRadius: 8, background: '#000', color: 'white', border: 'none' }}>Disaster Portal</button></Link>
          </nav>
        </header>

        <section style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ padding: 20, borderRadius: 10, background: 'linear-gradient(180deg,#fff,#f7fbff)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}>
              <h2 style={{ marginTop: 0, color: '#000' }}>Check weather & flood risk</h2>
              <p style={{ color: '#000' }}>Quickly check current precipitation and flood risk for any point in Malawi. Uses recent rainfall and river proximity heuristics to show likely risk.</p>
              <div style={{ marginTop: 12 }}>
                <button onClick={() => (window.location.href = '/map')} style={{ padding: '10px 14px', borderRadius: 8, background: '#000', color: 'white', border: 'none' }}>Open Map & Risk</button>
              </div>
            </div>
          </div>

          <div style={{ width: 380 }}>
            <div style={{ padding: 20, borderRadius: 10, background: '#fff', boxShadow: '0 6px 18px rgba(20,40,80,0.04)' }}>
              <h3 style={{ marginTop: 0, color: '#000' }}>Portal Access</h3>
              <p style={{ color: '#000' }}>Authorized users can log in to view alerts, community messages, and detailed forecasts.</p>
              <Link href="/portal/login"><button style={{ padding: '10px 14px', borderRadius: 8, background: '#000', color: 'white', border: 'none', width: '100%' }}>Login to Portal</button></Link>
            </div>
          </div>
        </section>

        <footer style={{ marginTop: 28, color: '#000', fontSize: 13 }}>
          © {new Date().getFullYear()} FloodDetect — Use responsibly. This is a demo system.
        </footer>
      </div>
    </main>
  );
}
// ...existing landing page above
