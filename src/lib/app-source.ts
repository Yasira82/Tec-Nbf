// The app's payment source slug — the SINGLE source of truth.
//
// This value flows into every payment's `metadata.source`, and tec-payment-service
// approves that payment under `PI_API_KEY_<SOURCE.toUpperCase()>`. It is imported by
// BOTH the client payment helper (src/lib/pi-payment.ts) and the server create route
// (src/app/api/bff/payment/create/route.ts) so the two can NEVER drift.
//
// ⚠️ New app: set this ONCE (and set the matching `PI_API_KEY_<SOURCE>` on
// tec-payment-service). Leaving it as 'app' makes Mode-2 approve fail with Pi 404
// `payment_not_found` — the July 2026 System incident (KB C-12 §11).
export const APP_SOURCE = 'app';
