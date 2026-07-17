'use client';

// TEC NBF — Business Foundation home (C-124), read-only V1.
// Establish + verify a Pi business identity in 25 minutes. NBF is Business Day-1;
// it coordinates the owning apps (Zone verifies, Commerce sells) and graduates
// into Titan at scale. It never verifies, transacts, or holds capital.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import {
  TEMPLATES, SAMPLE_BUSINESS, LAUNCH_STEPS, STATUS_META, GRADUATION_THRESHOLDS,
  type BusinessProfile,
} from '@/lib/nbf/business';
import NbfPro from './components/NbfPro';

export default function NbfHome() {
  // Start from the curated sample (renders instantly / SSR); replaced by the
  // caller's OWN live business once the BFF responds (identity from the session,
  // never a param — the BFF derives it). Falls back to the sample if none exists.
  const [b, setB]           = useState<BusinessProfile>(SAMPLE_BUSINESS);
  const [source, setSource] = useState<'sample' | 'live'>('sample');

  useEffect(() => {
    let alive = true;
    fetch('/api/bff/nbf/business', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.business) return;
        setB(d.business as BusinessProfile);
        setSource(d.source === 'live' ? 'live' : 'sample');
      })
      .catch(() => { /* keep the sample */ });
    return () => { alive = false; };
  }, []);

  const s = STATUS_META[b.status];
  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: '#e7e7ea', padding: '32px 22px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <header style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 34 }}>🏢</div>
          <h1 style={{ color: TEC_COLORS.gold, margin: '4px 0 2px', fontSize: 26 }}>TEC NBF</h1>
          <p style={{ opacity: 0.7, margin: 0, fontSize: 14 }}>
            Business Foundation Runtime — from &ldquo;I have an idea&rdquo; to a verified Pi business in 25 minutes.
          </p>
        </header>

        {/* Launch funnel */}
        <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 24, marginBottom: 10 }}>The 25-minute launch</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {LAUNCH_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: TEC_COLORS.surface, borderRadius: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: TEC_COLORS.goldDark, color: '#020205', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{step.title} {step.minutes > 0 && <span style={{ opacity: 0.5, fontWeight: 400 }}>· {step.minutes}m</span>}</div>
                <div style={{ opacity: 0.6, fontSize: 12 }}>{step.note}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Templates */}
        <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 28, marginBottom: 12 }}>Business templates</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {TEMPLATES.map((t) => (
            <Link key={t.type} href={`/template/${t.type}`} style={{ textDecoration: 'none' }}>
              <div style={{ padding: 14, background: TEC_COLORS.surface, borderRadius: 12, border: '1px solid #ffffff10', height: '100%' }}>
                <div style={{ fontSize: 20 }}>{t.icon}</div>
                <div style={{ color: '#e7e7ea', fontWeight: 700, marginTop: 8 }}>{t.label}</div>
                <div style={{ opacity: 0.65, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>{t.description}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Business + graduation (own profile when live, sample otherwise) */}
        <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 28, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          {source === 'live' ? 'Your business' : 'Example business'}
          <span style={{ fontSize: 11, fontWeight: 400, color: source === 'live' ? '#22C55E' : TEC_COLORS.gold, border: `1px solid ${(source === 'live' ? '#22C55E' : TEC_COLORS.gold)}55`, borderRadius: 999, padding: '2px 10px' }}>
            {source === 'live' ? 'live' : 'sample'}
          </span>
        </h2>
        <div style={{ padding: 18, background: TEC_COLORS.surface, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontWeight: 700 }}>{b.name}</span> <span style={{ opacity: 0.5, fontSize: 12 }}>@{b.handle}</span>
            </div>
            <span style={{ fontSize: 11, color: s.tone, border: `1px solid ${s.tone}55`, borderRadius: 20, padding: '2px 9px' }}>{s.label}{b.zoneVerified ? ' · ✓ Zone' : ''}</span>
          </div>
          <div style={{ opacity: 0.65, fontSize: 12.5, marginTop: 6 }}>{b.tagline}</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 12, opacity: 0.8, flexWrap: 'wrap' }}>
            <span>👁️ {b.analytics.profileViews.toLocaleString()} views</span>
            <span>π {b.analytics.piReceived.toLocaleString()} received</span>
            <span>👥 {b.analytics.customers} customers</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, borderTop: '1px solid #ffffff10', paddingTop: 10 }}>
            Graduation to Titan: team {b.graduation.teamSize}/{GRADUATION_THRESHOLDS.teamSize} · revenue π{b.graduation.monthlyRevenuePi}/{GRADUATION_THRESHOLDS.monthlyRevenuePi}/mo →{' '}
            <span style={{ color: b.graduation.titanReady ? TEC_COLORS.gold : '#9ca3af' }}>{b.graduation.titanReady ? 'ready for Titan' : 'growing'}</span>
          </div>
        </div>

        <p style={{ opacity: 0.55, fontSize: 12, marginTop: 20, lineHeight: 1.6, borderLeft: `2px solid ${TEC_COLORS.gold}55`, paddingLeft: 12 }}>
          <strong>Boundary (C-124).</strong> NBF establishes the business identity. Verification is minted by
          Zone (presented here), transactions by Commerce/payment-service, capital by FundX, reputation by
          Legend — NBF coordinates them by ID. A business graduates into Titan (C-130) at scale.{source === 'live' ? '' : ' Read-only sample.'}
        </p>

        {/* NBF Pro */}
        <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 32, marginBottom: 12 }}>Upgrade</h2>
        <NbfPro />
      </div>
    </main>
  );
}
