"use client";

import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ fontFamily: 'Inter, system-ui, -apple-system, Roboto, sans-serif', minHeight: '100vh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ maxWidth: 1200, width: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e5e7eb' }}>

        {/* Hero Section */}
        <div style={{ background: '#000000', padding: '60px 40px', textAlign: 'center', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(0, 0, 0, 0) 100%)' }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="#3b82f6" opacity="0.9" />
                <circle cx="12" cy="12" r="3" fill="#fff" />
              </svg>
            </div>
            <h1 style={{ margin: 0, fontSize: 42, fontWeight: 800, letterSpacing: '-0.02em' }}>FloodDetect Malawi</h1>
            <p style={{ margin: '16px 0 0 0', fontSize: 18, opacity: 0.9, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
              Real-time flood risk monitoring and early warning system powered by AI and satellite data
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div style={{ padding: '50px 40px', background: '#fafafa' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 40 }}>

            {/* Feature 1 */}
            <div style={{ padding: 24, borderRadius: 12, background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#3b82f6" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#000000' }}>Live Risk Mapping</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                Interactive maps showing real-time flood risk levels across all districts in Malawi
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{ padding: 24, borderRadius: 12, background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="#fff" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#000000' }}>AI-Powered Alerts</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                Smart chatbot assistant providing instant flood risk information and safety guidance
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{ padding: 24, borderRadius: 12, background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2" />
                  <path d="M12 6v6l4 2" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#000000' }}>24/7 Monitoring</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                Continuous rainfall tracking and automated risk assessment for early warnings
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

            {/* Primary CTA */}
            <div style={{ padding: 32, borderRadius: 12, background: '#000000', color: '#fff', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)' }}></div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#3b82f6" opacity="0.9" />
                    <circle cx="12" cy="10" r="3" fill="#fff" />
                  </svg>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Check Flood Risk</h2>
                </div>
                <p style={{ margin: '0 0 20px 0', opacity: 0.9, fontSize: 15 }}>
                  Access live weather data and flood risk assessment for any location in Malawi
                </p>
                <button
                  onClick={() => window.location.href = '/map'}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 10,
                    background: '#fff',
                    color: '#000',
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Open Live Map →
                </button>
              </div>
            </div>

            {/* Secondary CTA */}
            <div style={{ padding: 32, borderRadius: 12, background: '#ffffff', border: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#3b82f6" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#000000' }}>DoDMA Admin Portal</h2>
              </div>
              <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: 15 }}>
                Authorized personnel can access detailed analytics, create alerts, and manage disaster response
              </p>
              <Link href="/portal/login">
                <button
                  style={{
                    padding: '14px 28px',
                    borderRadius: 10,
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
                >
                  Login to Portal
                </button>
              </Link>
            </div>
          </div>

          {/* Stats Section */}
          <div style={{ marginTop: 50, padding: 30, borderRadius: 12, background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#000000', marginBottom: 4 }}>24/7</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Monitoring</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6', marginBottom: 4 }}>28</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Districts Covered</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#000000', marginBottom: 4 }}>AI</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Powered Insights</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6', marginBottom: 4 }}>Real-time</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Data Updates</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ padding: '30px 40px', background: '#000000', color: '#fff', textAlign: 'center' }}>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>
            © {new Date().getFullYear()} FloodDetect Malawi — Protecting communities through technology
          </p>
          <p style={{ margin: '8px 0 0 0', opacity: 0.6, fontSize: 12 }}>
            This is a demonstration system. Use responsibly and verify critical information.
          </p>
        </footer>
      </div>
    </main>
  );
}
