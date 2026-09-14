// Canonical Pi payment client for a TEC app (ADR-007 dual-mode, ADR-009 contract).
//
// Usage in a buy handler — ALWAYS keep the ADR-007 hub-navigation guard:
//
//   const isHubNavigation = () =>
//     document.referrer.toLowerCase().includes('hub.tecosystem.app');
//
//   if (isHubNavigation() || !(window as any).Pi || !piReady) {
//     redirectToHubPayment(...);   // Mode 1: Hub modal
//     return;
//   }
//   const internalId = await createPaymentRecord(amount, itemId, memo);   // Mode 2
//   if (!internalId) return;
//   const result = await createU2APayment(amount, memo, { item_id: itemId }, internalId);

import { APP_SOURCE } from './app-source';

const getCsrfToken = (): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.match(/(?:^|;\s*)tec_csrf=([^;]*)/)?.[1] ?? '';

const getToken = (): string | null =>
  typeof document === 'undefined' ? null :
  document.cookie.match(/(?:^|;\s*)tec_access_token=([^;]*)/)?.[1] ?? null;

export interface PaymentResult {
  status:     'completed' | 'cancelled' | 'error';
  success:    boolean;
  paymentId?: string;
  txid?:      string;
  message?:   string;
}

// Resolve the Hub URL defensively: a misconfigured env (e.g. the literal
// placeholder `C_HUB_URL`, or an empty string) must NEVER become the redirect
// target — it produces `C_HUB_URL/hub` → 404 (the July 2026 System incident).
// Accept a value ONLY if it's a real http(s) URL; else use the canonical Hub.
import { hubPaymentOrigin, isHubReferrer } from '@/lib/pi-network';
import { piSession } from '@/lib/pi/pi-session';

const HUB_FALLBACK = 'https://hub.tecosystem.app';
const HUB_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_HUB_URL;
  return raw && /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, '') : HUB_FALLBACK;
})();

/**
 * ADR-007: true when the user arrived FROM the Hub (Pi session is foreign).
 * Two signals (C-12 §3): the sessionStorage flag persisted by the SSO landing
 * page (the C-123 LAW-2 landing erases the hub referrer via location.replace),
 * with document.referrer as fallback for direct hub→app hops.
 *
 * The referrer test covers BOTH Hub hosts (`isHubReferrer`). It used to name
 * only the Mainnet Hub, so a hop from the Testnet Hub read as standalone and
 * this app called Pi.authenticate() inside a session the Hub owns — which never
 * answers, and shows up only as the 90s payment timeout with the Pi wallet
 * never opening. See pi-network.ts for the full note.
 */
export const isHubNavigation = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem('__tec_hub_entry') === '1') return true;
  } catch { /* storage unavailable — fall back to referrer */ }
  return isHubReferrer(document.referrer);
};

/** Mode 1 — hand the payment off to the Hub modal. `/hub?pay=1` is LOCKED (C-76/ADR-007). */
export const redirectToHubPayment = (params: {
  amount: number; itemId: string; memo?: string;
}): void => {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams({
    pay:    '1',
    source: APP_SOURCE,
    amount: String(params.amount),
    item:   params.itemId,
    // Where the Hub sends the user back — on Cancel AND on success. Omitting it
    // left the Hub defaulting to its OWN /hub, so cancelling a payment that
    // started here dropped the user on the Hub: they never left this app in
    // their mind, and the app never learned the outcome (`/app` is where
    // ?payment_status is read). Always say where home is.
    return_url: `${window.location.origin}/app`,
    ...(params.memo ? { memo: params.memo } : {}),
  });
  window.location.href = `${hubPaymentOrigin(HUB_URL)}/hub?${q.toString()}`;
};

/** Step 1 — create the payment record in tec-payment-service; returns internal id. */
export const createPaymentRecord = async (
  amount: number, itemId: string, memo: string,
): Promise<string | null> => {
  try {
    const token = getToken();
    if (!token) return null;
    const res = await fetch('/api/bff/payment/create', {
      method: 'POST', credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': getCsrfToken(),
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ amount, memo, metadata: { source: APP_SOURCE, item_id: itemId } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.payment?.id ?? data?.data?.id ?? data?.id ?? null;
  } catch { return null; }
};

/** Step 2 — run the Pi User-to-App payment (Mode 2 / standalone in Pi Browser). */
/**
 * `onStage` reports WHICH step is running.
 *
 * Without it a Mode-2 payment shows one message from the tap until it settles,
 * and that message covers four different waits: the Pi sign-in handshake, the
 * wallet sheet, our approve call, and chain confirmation. When a payment hangs
 * — which is the failure this flow actually has — a single label cannot say
 * which of the four is stuck, so every diagnosis starts as a guess. One tap
 * with a stage label answers it instead.
 */
export const createU2APayment = async (
  amount: number, memo: string, metadata: Record<string, unknown>, internalId: string,
  onStage?: (stage: string) => void,
): Promise<PaymentResult> => {
  return new Promise(async (resolve) => {
    let stage = 'starting';
    const at = (s: string, label: string) => { stage = s; onStage?.(label); };
    if (!window.Pi) { resolve({ status: 'error', success: false, message: 'Pi SDK not ready' }); return; }
    if ((window as any).__TEC_PI_FOREIGN_SESSION) { resolve({ status: 'error', success: false, message: 'foreign_session' }); return; }

    let settled = false;
    const done = (result: PaymentResult) => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
    const timer = setTimeout(
      () => done({ status: 'error', success: false, message: `Timed out at: ${stage}. Nothing was charged — please try again.` }),
      90_000,
    );

    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // The handshake normally already happened at page load (PiWarmup), so this
    // resolves immediately and the tap goes straight to createPayment. It is a
    // gate, not a second call: if a warm-up is still running this JOINS it —
    // two concurrent Pi.authenticate calls are what Pi Browser answers neither
    // of. See lib/pi/pi-session.ts.
    at('pi-signin', 'Signing in to Pi…');
    if (!(await piSession.ensureAuth())) {
      const why = piSession.lastAuthError;
      done({
        status: 'error', success: false,
        message: why ? `Pi sign-in failed: ${why}` : 'Pi sign-in failed — please try again.',
      });
      return;
    }

    at('pi-wallet', 'Opening the Pi wallet…');
    try {
      window.Pi.createPayment(
        { amount, memo, metadata: { ...metadata, internalId } },
        {
          onReadyForServerApproval: async (piPaymentId: string) => {
            at('server-approve', 'Approving payment…');
            try {
              const res = await fetch('/api/bff/payment/approve', {
                method: 'POST', credentials: 'include', headers,
                body: JSON.stringify({ payment_id: internalId, pi_payment_id: piPaymentId }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                done({ status: 'error', success: false, message: (err as Record<string, unknown>)?.error as string ?? 'Approve failed' });
              }
            } catch (err) { done({ status: 'error', success: false, message: String(err) }); }
          },
          onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
            at('server-complete', 'Confirming on the Pi chain…');
            try {
              const res  = await fetch('/api/bff/payment/complete', {
                method: 'POST', credentials: 'include', headers,
                body: JSON.stringify({ payment_id: internalId, transaction_id: txid, pi_payment_id: piPaymentId }),
              });
              const data = await res.json().catch(() => ({}));
              done(res.ok
                ? { status: 'completed', success: true, paymentId: internalId, txid }
                : { status: 'error', success: false, message: (data as Record<string, unknown>)?.error as string ?? 'Complete failed' });
            } catch (err) { done({ status: 'error', success: false, message: String(err) }); }
          },
          onCancel: () => done({ status: 'cancelled', success: false }),
          onError:  (err: Error) => done({ status: 'error', success: false, message: err.message }),
        },
      );
    } catch (err) {
      done({ status: 'error', success: false, message: err instanceof Error ? err.message : 'Pi payment error — please try again.' });
    }
  });
};
