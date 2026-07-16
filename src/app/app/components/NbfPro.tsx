'use client';

// NbfPro — the real Pi U2A payment surface (the Pi Portal "Process a Transaction"
// gate). NBF Pro is a subscription (C-124 §Revenue: 25π/month): unlimited business
// profiles, priority Zone verification, advanced analytics, team collaboration.
// Keeps the ADR-007 dual-mode guard.
import { useEffect, useState } from 'react';
import { TEC_COLORS } from '@yasser172/tec-ui';
import {
  isHubNavigation,
  redirectToHubPayment,
  createPaymentRecord,
  createU2APayment,
} from '@/lib/pi-payment';

const NBF_PRO = { id: 'nbf-pro', name: 'NBF Pro (monthly)', price: 25 };

export default function NbfPro() {
  const [piReady, setPiReady] = useState(false);
  const [status, setStatus]   = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as { __TEC_PI_READY?: boolean }).__TEC_PI_READY) setPiReady(true);
    const onReady = () => setPiReady(true);
    window.addEventListener('tec-pi-ready', onReady);
    return () => window.removeEventListener('tec-pi-ready', onReady);
  }, []);

  const handleSubscribe = async () => {
    const { id, name, price } = NBF_PRO;

    // ── ADR-007 guard — ALWAYS before touching window.Pi ──
    if (isHubNavigation() || !(window as { Pi?: unknown }).Pi || !piReady) {
      redirectToHubPayment({ amount: price, itemId: id, memo: name });   // Mode 1
      return;
    }

    // ── Mode 2: standalone Pi Browser payment ──
    setStatus('Creating payment…');
    const internalId = await createPaymentRecord(price, id, name);
    if (!internalId) { setStatus('Could not start payment.'); return; }

    setStatus('Awaiting Pi approval…');
    const result = await createU2APayment(price, name, { item_id: id }, internalId);
    setStatus(
      result.success ? `✅ Subscribed — txid ${result.txid}` :
      result.status === 'cancelled' ? 'Payment cancelled.' :
      `❌ ${result.message ?? 'Payment failed.'}`,
    );
  };

  return (
    <div style={{
      padding: 20, background: TEC_COLORS.surface, borderRadius: 14,
      border: `1px solid ${TEC_COLORS.gold}33`, maxWidth: 440,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0, color: TEC_COLORS.gold, fontSize: 18 }}>NBF Pro</h2>
        <span style={{ color: TEC_COLORS.gold, fontWeight: 800 }}>π 25<span style={{ opacity: 0.6, fontSize: 12, fontWeight: 500 }}>/mo</span></span>
      </div>
      <p style={{ opacity: 0.75, fontSize: 13, margin: '8px 0 14px' }}>
        Unlimited business profiles · priority Zone verification · advanced analytics · team collaboration.
      </p>
      <button
        onClick={handleSubscribe}
        style={{
          background: `linear-gradient(135deg, ${TEC_COLORS.gold}, ${TEC_COLORS.goldDark})`,
          color: '#0a0800', border: 'none', borderRadius: 10,
          padding: '11px 20px', fontWeight: 700, cursor: 'pointer',
        }}>
        Subscribe with Pi
      </button>
      <p style={{ opacity: 0.5, fontSize: 11, marginTop: 10 }}>Pi SDK: {piReady ? 'ready' : 'loading…'}</p>
      {status && <p style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}
