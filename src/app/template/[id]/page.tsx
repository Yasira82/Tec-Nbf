// TEC NBF — business template detail (C-124), read-only, statically generated.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TEC_COLORS } from '@yasser172/tec-ui';
import { TEMPLATES, getTemplate, LAUNCH_STEPS } from '@/lib/nbf/business';

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.type }));
}

export default async function TemplateDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = getTemplate(id);
  if (!t) notFound();

  return (
    <main style={{ minHeight: '100vh', background: TEC_COLORS.bg, color: '#e7e7ea', padding: '32px 22px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/app" style={{ color: TEC_COLORS.gold, fontSize: 13, textDecoration: 'none' }}>← Back</Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 30 }}>{t.icon}</span>
          <h1 style={{ color: TEC_COLORS.gold, margin: 0, fontSize: 24 }}>{t.label}</h1>
        </div>
        <p style={{ marginTop: 14, lineHeight: 1.6, opacity: 0.9 }}>{t.description}</p>

        <h2 style={{ color: TEC_COLORS.gold, fontSize: 15, marginTop: 24 }}>Setup checklist</h2>
        <ul style={{ lineHeight: 1.8, opacity: 0.9, paddingLeft: 20 }}>
          {t.checklist.map((c, i) => <li key={i}>{c}</li>)}
        </ul>

        <h2 style={{ color: TEC_COLORS.gold, fontSize: 15, marginTop: 24 }}>Launch flow (25 min)</h2>
        <ol style={{ lineHeight: 1.7, opacity: 0.85, paddingLeft: 20, fontSize: 13.5 }}>
          {LAUNCH_STEPS.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s.title}{s.minutes > 0 ? ` (${s.minutes}m)` : ''} — {s.note}</li>)}
        </ol>

        <p style={{ marginTop: 20, fontSize: 12, opacity: 0.55, lineHeight: 1.6, borderLeft: `2px solid ${TEC_COLORS.gold}55`, paddingLeft: 12 }}>
          Verification is issued by Zone (NBF presents the badge, never mints it); products list in Commerce;
          the business graduates into Titan at scale. Read-only sample.
        </p>
      </div>
    </main>
  );
}
