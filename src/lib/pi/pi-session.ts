'use client';

// The Pi session for this origin — authenticated ONCE, reused by every caller.
//
// Why this file exists
// --------------------
// `createU2APayment` used to call `Pi.authenticate(...)` unconditionally, on
// every Pay tap. That put the entire Pi handshake AFTER the tap, so the button
// held the user for however long the handshake took.
//
// Normally that is fast. It is NOT fast right after a payment in the Hub: Pi
// Browser is then inside the Hub's Pi app, and the next authenticate here has
// to switch the Pi app context first. Same code, same tap, a much longer wait —
// which is exactly the "I pay in the Hub, come back, and the app payment hangs"
// sequence.
//
// The handshake cannot be made faster; it can be made to happen at a moment
// that costs the user nothing. So it runs on PAGE LOAD (see PiWarmup) while the
// user is still reading the screen, and the tap reuses the result. The wait did
// not get shorter — it moved off the tap.
//
// Two rules this enforces, both learned the hard way:
//   1. Never two concurrent `Pi.authenticate` calls. Pi Browser answers neither
//      reliably; the loser dies silently on its own timer. Every caller here —
//      login and payment — goes through the same single-flight promise.
//   2. Never authenticate in a Hub-owned session (ADR-007). It never answers.

import { PiRuntime } from './PiRuntime';

const getCookie = (name: string): string =>
  typeof document === 'undefined' ? '' :
  document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1] ?? '';

/**
 * Default incomplete-payment handler. It must live here, not at the payment
 * call site: once the warm-up owns the authenticate, the handler passed to Pi
 * is this one for the whole page — an unfinished payment has to be resolvable
 * even when nobody has tapped Pay yet.
 */
/**
 * Say something when Pi reports an unfinished payment.
 *
 * Pi refuses to open a new payment while the user has one still open, and it
 * announces that through this callback DURING the handshake — which is exactly
 * the moment the screen is sitting on "Signing in to Pi…". Until now the whole
 * exchange was silent: whether Pi found one at all, and whether clearing it
 * worked, were both invisible. A stuck payment and an unreachable Pi produce
 * the identical blank wait, and they need opposite responses.
 *
 * Set by the payment flow for the duration of a tap; null the rest of the time
 * (the page-load warm-up has no screen to talk to).
 */
let notify: ((message: string) => void) | null = null;
export const setPiNotice = (fn: ((message: string) => void) | null): void => { notify = fn; };

const resolveIncomplete = async (incomplete: unknown): Promise<void> => {
  const pid = (incomplete as { identifier?: string } | null)?.identifier;
  if (!pid) return;
  notify?.(`Pi found an unfinished payment (${pid.slice(0, 8)}…) — clearing it…`);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-csrf-token': getCookie('tec_csrf'),
  };
  const token = getCookie('tec_access_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch('/api/bff/payment/resolve-incomplete', {
      method: 'POST', credentials: 'include', headers,
      body: JSON.stringify({ pi_payment_id: pid }),
    });
    // Still best-effort — it must never fail the payment — but no longer silent.
    // An unfinished payment that cannot be cleared blocks every future payment,
    // so it is the one thing the user most needs told.
    notify?.(res.ok
      ? 'Unfinished payment cleared — tap Renew again.'
      : `Could not clear the unfinished payment (HTTP ${res.status}). Pi will keep refusing new payments until it clears.`);
  } catch (err) {
    notify?.(`Could not clear the unfinished payment: ${err instanceof Error ? err.message : String(err)}`);
  }
};

let authenticated = false;
let inFlight: Promise<boolean> | null = null;

/**
 * Why the last handshake did not succeed.
 *
 * `ensureAuth` returns a bare boolean, and it returns false for four unrelated
 * reasons: a Hub-owned session, no SDK, the circuit breaker being OPEN, and Pi
 * itself rejecting. The catch below used to be `.catch(() => false)`, which
 * threw away the ONE sentence that distinguishes them — so every one of the
 * four reached the user as "Pi auth failed", the message that fits all of them
 * and helps with none.
 *
 * The breaker matters most here. After three failures it stops calling Pi for
 * 60 seconds and reports OPEN, so tapping again during that window returns a
 * failure that has nothing to do with the original cause and hides it.
 */
let lastError: string | null = null;

/** A Hub-owned session (ADR-007) — authenticating here would never answer. */
const isForeignSession = (): boolean =>
  typeof window !== 'undefined' &&
  (window as unknown as { __TEC_PI_FOREIGN_SESSION?: boolean }).__TEC_PI_FOREIGN_SESSION === true;

export const piSession = {
  /** True only while the SDK is still present — a marked session with no SDK is stale. */
  get isAuthenticated(): boolean {
    return authenticated && PiRuntime.isAvailable();
  },

  /** True while a handshake is running (warm-up or tap). */
  get isAuthInFlight(): boolean {
    return inFlight !== null;
  },

  /**
   * Resolve to an authenticated Pi session, authenticating at most once.
   * A tap arriving mid-warm-up joins the SAME promise — it never starts a
   * second concurrent authenticate.
   */
  ensureAuth(): Promise<boolean> {
    if (this.isAuthenticated) { lastError = null; return Promise.resolve(true); }
    if (isForeignSession()) {
      lastError = 'this session belongs to the Hub (ADR-007) — pay from the Hub instead';
      return Promise.resolve(false);
    }
    if (!PiRuntime.isAvailable()) {
      lastError = 'the Pi SDK is not present on this page';
      return Promise.resolve(false);
    }

    if (!inFlight) {
      inFlight = PiRuntime
        .authenticate(['username', 'payments'], (p: unknown) => { void resolveIncomplete(p); })
        .then(() => { authenticated = true;  lastError = null; return true;  })
        .catch((err: unknown) => {
          authenticated = false;
          // Keep what Pi said. It is the only thing that separates "this app is
          // not registered for this host" from "the user declined" from "the
          // breaker is OPEN", and each wants a different fix.
          lastError = err instanceof Error ? err.message : String(err ?? 'unknown Pi error');
          return false;
        })
        .finally(() => { inFlight = null; });
    }
    return inFlight;
  },

  /** The reason the last `ensureAuth` failed, or null if it succeeded. */
  get lastAuthError(): string | null {
    return lastError;
  },

  /** Fire-and-forget warm-up. Failure is silent: the tap will simply retry. */
  warm(): void {
    void this.ensureAuth();
  },

  /**
   * Record a session established elsewhere (login authenticates with the same
   * scopes). Without this the first Pay tap ran a second, redundant handshake.
   */
  markAuthenticated(): void {
    authenticated = true;
  },

  reset(): void {
    authenticated = false;
    inFlight      = null;
  },
};
