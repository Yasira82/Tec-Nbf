'use client';

// TEC NBF — Business Foundation home (C-124).
// Establish + launch a Pi business identity. NBF is Business Day-1; it coordinates
// the owning apps (Zone verifies, Commerce sells, FundX funds) and graduates into
// Titan at scale. It never verifies, transacts, or holds capital.
//
// This page is the WRITE surface: the caller establishes their OWN business (DRAFT)
// and launches it (→ ACTIVE) against the real NBF backend. Identity is the session
// (never a client param, P6); the create/publish calls forward the session JWT and
// the backend derives the owner from the token.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { useTranslation } from '@/lib/i18n';
import {
  TEMPLATES, LAUNCH_STEPS, STATUS_META, GRADUATION_THRESHOLDS,
  type BusinessProfile, type BusinessType,
} from '@/lib/nbf/business';
import { buildHeaders } from '@/lib/request-id';
import NbfPro from './components/NbfPro';
import { BottomNav, type NbfTab } from './components/BottomNav';
import { SettingsView } from './components/SettingsView';

type Source = 'live' | 'empty' | 'sample' | 'loading';

export default function NbfHome() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<NbfTab>('home');
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [source, setSource]     = useState<Source>('loading');

  // Create-form state
  const [name, setName]       = useState('');
  const [type, setType]       = useState<BusinessType>('STORE');
  const [tagline, setTagline] = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Load the caller's OWN business (identity from the session, server-side).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res  = await fetch('/api/bff/nbf/business', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setBusiness(data.business ?? null);
        setSource((data.source as Source) ?? 'sample');
      } catch {
        if (alive) setSource('sample');
      }
    })();
    return () => { alive = false; };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/bff/nbf/business', {
        method:  'POST',
        headers: buildHeaders(null),   // adds Content-Type + X-CSRF-Token (double-submit)
        body:    JSON.stringify({ name, type, tagline: tagline || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 401 ? 'Please sign in to establish a business.'
          : res.status === 409 ? 'You already have a business.'
          : (data.error ?? 'Could not create the business.'));
        return;
      }
      setBusiness(data.business);
      setSource('live');
      setName(''); setTagline('');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (busy || !business) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/bff/nbf/business/${encodeURIComponent(business.handle)}/publish`, {
        method:  'PATCH',
        headers: buildHeaders(null),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not launch the business.');
        return;
      }
      setBusiness(data.business);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const hasOwn = source === 'live' && business;

  const headerTitle =
    tab === 'templates' ? t.nbf.nav.templates
    : tab === 'pro' ? t.nbf.nav.pro
    : tab === 'settings' ? t.nbf.nav.settings
    : t.nbf.brand;

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: '#e7e7ea', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 22px calc(96px + env(safe-area-inset-bottom))' }}>
        <header style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 34 }}>🏢</div>
          <h1 style={{ color: TEC_COLORS.gold, margin: '4px 0 2px', fontSize: 26 }}>{headerTitle}</h1>
          {tab === 'home' && (
            <p style={{ opacity: 0.7, margin: 0, fontSize: 14 }}>{t.nbf.tagline}</p>
          )}
        </header>

        {/* ── HOME ────────────────────────────────────────────────── */}
        {tab === 'home' && (<>
          {/* Your business (live) OR establish form */}
          {hasOwn ? (
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginBottom: 12 }}>Your business</h2>
              <OwnBusinessCard business={business!} busy={busy} onPublish={handlePublish} error={error} />
            </section>
          ) : (
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginBottom: 12 }}>Establish your business</h2>
              <form onSubmit={handleCreate} style={{ padding: 18, background: TEC_COLORS.surface, borderRadius: 12, display: 'grid', gap: 12 }}>
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={{ fontSize: 12.5, opacity: 0.75 }}>Business name</span>
                  <input
                    value={name} onChange={(e) => setName(e.target.value)}
                    required minLength={2} maxLength={80} placeholder="e.g. Pi Corner Store"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={{ fontSize: 12.5, opacity: 0.75 }}>Type</span>
                  <select value={type} onChange={(e) => setType(e.target.value as BusinessType)} style={inputStyle}>
                    {TEMPLATES.map((tpl) => (
                      <option key={tpl.type} value={tpl.type}>{tpl.icon} {tpl.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={{ fontSize: 12.5, opacity: 0.75 }}>Tagline <span style={{ opacity: 0.5 }}>(optional)</span></span>
                  <input
                    value={tagline} onChange={(e) => setTagline(e.target.value)}
                    maxLength={140} placeholder="Everyday goods, paid in Pi."
                    style={inputStyle}
                  />
                </label>
                {error && <div style={{ color: '#EF4444', fontSize: 12.5 }}>{error}</div>}
                <button type="submit" disabled={busy || name.trim().length < 2} style={primaryBtn(busy || name.trim().length < 2)}>
                  {busy ? 'Establishing…' : 'Establish business (Draft)'}
                </button>
                <p style={{ opacity: 0.55, fontSize: 11.5, margin: 0 }}>
                  Starts as a <strong>Draft</strong>. Verification is issued by Zone (not here); your business
                  appears in Explorer and can sell via Commerce once launched.
                </p>
              </form>
            </section>
          )}

          {/* Launch funnel */}
          <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 28, marginBottom: 10 }}>The 25-minute launch</h2>
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

          <p style={{ opacity: 0.55, fontSize: 12, marginTop: 20, lineHeight: 1.6, borderLeft: `2px solid ${TEC_COLORS.gold}55`, paddingLeft: 12 }}>
            <strong>Boundary.</strong> NBF establishes the business identity. Verification is minted by
            Zone (presented here), transactions by Commerce/payment-service, capital by FundX, reputation by
            Legend — NBF coordinates them by ID. A business graduates into Titan at scale.
          </p>
        </>)}

        {/* ── TEMPLATES ───────────────────────────────────────────── */}
        {tab === 'templates' && (<>
          <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 12, marginBottom: 12 }}>{t.nbf.businessTemplates}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {TEMPLATES.map((tpl) => (
              <Link key={tpl.type} href={`/template/${tpl.type}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: 14, background: TEC_COLORS.surface, borderRadius: 12, border: '1px solid #ffffff10', height: '100%' }}>
                  <div style={{ fontSize: 20 }}>{tpl.icon}</div>
                  <div style={{ color: '#e7e7ea', fontWeight: 700, marginTop: 8 }}>{tpl.label}</div>
                  <div style={{ opacity: 0.65, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>{tpl.description}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Curated example (only when the caller has no business of their own) */}
          {!hasOwn && business && (
            <>
              <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 28, marginBottom: 12 }}>Example business</h2>
              <OwnBusinessCard business={business} busy={false} readOnly />
            </>
          )}
        </>)}

        {/* ── PRO ─────────────────────────────────────────────────── */}
        {tab === 'pro' && (<>
          <h2 style={{ color: TEC_COLORS.gold, fontSize: 16, marginTop: 12, marginBottom: 12 }}>{t.nbf.upgrade}</h2>
          <NbfPro />
        </>)}

        {/* ── SETTINGS ────────────────────────────────────────────── */}
        {tab === 'settings' && <SettingsView />}
      </div>

      <BottomNav active={tab} onSelect={setTab} />
    </main>
  );
}

function OwnBusinessCard({
  business: b, busy, onPublish, error, readOnly,
}: {
  business: BusinessProfile; busy: boolean;
  onPublish?: () => void; error?: string | null; readOnly?: boolean;
}) {
  const s = STATUS_META[b.status];
  return (
    <div style={{ padding: 18, background: TEC_COLORS.surface, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontWeight: 700 }}>{b.name}</span> <span style={{ opacity: 0.5, fontSize: 12 }}>@{b.handle}</span>
        </div>
        <span style={{ fontSize: 11, color: s.tone, border: `1px solid ${s.tone}55`, borderRadius: 20, padding: '2px 9px' }}>
          {s.label}{b.zoneVerified ? ' · ✓ Zone' : ''}
        </span>
      </div>
      {b.tagline && <div style={{ opacity: 0.65, fontSize: 12.5, marginTop: 6 }}>{b.tagline}</div>}
      <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 12, opacity: 0.8, flexWrap: 'wrap' }}>
        <span>👁️ {b.analytics.profileViews.toLocaleString()} views</span>
        <span>π {b.analytics.piReceived.toLocaleString()} received</span>
        <span>👥 {b.analytics.customers} customers</span>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, borderTop: '1px solid #ffffff10', paddingTop: 10 }}>
        Graduation to Titan: team {b.graduation.teamSize}/{GRADUATION_THRESHOLDS.teamSize} · revenue π{b.graduation.monthlyRevenuePi}/{GRADUATION_THRESHOLDS.monthlyRevenuePi}/mo →{' '}
        <span style={{ color: b.graduation.titanReady ? TEC_COLORS.gold : '#9ca3af' }}>{b.graduation.titanReady ? 'ready for Titan' : 'growing'}</span>
      </div>

      {/* Launch action — only a DRAFT the caller owns can be launched here */}
      {!readOnly && b.status === 'DRAFT' && (
        <div style={{ marginTop: 14, borderTop: '1px solid #ffffff10', paddingTop: 12 }}>
          {error && <div style={{ color: '#EF4444', fontSize: 12.5, marginBottom: 8 }}>{error}</div>}
          <button onClick={onPublish} disabled={busy} style={primaryBtn(busy)}>
            {busy ? 'Launching…' : '🚀 Launch business (go Active)'}
          </button>
          <p style={{ opacity: 0.55, fontSize: 11.5, margin: '8px 0 0' }}>
            Launching makes your business public and discoverable in Explorer. Zone verification is requested
            separately and issued asynchronously (NBF never self-verifies).
          </p>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', background: TEC_COLORS.bg, color: '#e7e7ea',
  border: '1px solid #ffffff1a', borderRadius: 9, fontSize: 14, outline: 'none',
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '11px 16px', borderRadius: 9, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? '#ffffff1a' : TEC_COLORS.goldDark, color: disabled ? '#9ca3af' : '#020205',
  fontWeight: 800, fontSize: 13.5, width: '100%',
});
