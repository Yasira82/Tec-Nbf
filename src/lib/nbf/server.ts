import { SAMPLE_BUSINESS, type BusinessProfile, type BusinessType, type BusinessStatus } from './business';

// Server-only NBF backend access (C-124). Calls the real NBF business-identity
// module (identity-service) via the gateway with the inter-service key, and maps
// the backend row to the frontend BusinessProfile. Degrades to the curated sample
// so the page is never blank / never 500s. NEW-A: the gateway URL is server-only
// (API_GATEWAY_URL) — never shipped to the client.
const GW = process.env.API_GATEWAY_URL ?? '';

const gwHeaders = () => ({
  'Content-Type': 'application/json',
  'x-request-id': crypto.randomUUID(),
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
});

const n = (v: unknown) => Number(v ?? 0);

// backend (nbf_businesses) → frontend BusinessProfile (type/status enums already match)
export function businessFromBackend(b: Record<string, unknown>): BusinessProfile {
  return {
    handle:       String(b.handle ?? ''),
    name:         String(b.name ?? ''),
    type:         String(b.type ?? 'STORE') as BusinessType,
    tagline:      String(b.tagline ?? ''),
    status:       String(b.status ?? 'DRAFT') as BusinessStatus,
    zoneVerified: Boolean(b.zone_verified),
    analytics: {
      profileViews: n(b.profile_views),
      piReceived:   n(b.pi_received),
      customers:    n(b.customers),
    },
    graduation: {
      teamSize:         n(b.team_size),
      monthlyRevenuePi: n(b.monthly_revenue_pi),
      activeProjects:   n(b.active_projects),
      customerCount:    n(b.customer_count),
      titanReady:       Boolean(b.titan_ready),
    },
  };
}

export interface ResolvedBusiness { business: BusinessProfile; source: 'live' | 'sample'; }

// The caller's OWN business — live backend first, curated sample as fallback.
// `owner` is derived from the session by the BFF (never a client param, P6); when
// absent or unknown, the sample business is served so the page is never blank.
export async function resolveBusiness(owner: string | null): Promise<ResolvedBusiness> {
  if (GW && owner) {
    try {
      const res = await fetch(`${GW}/api/identity/nbf/business/by-owner/${encodeURIComponent(owner)}`, {
        headers: gwHeaders(), cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const b = data?.data?.business;
        if (b) return { business: businessFromBackend(b as Record<string, unknown>), source: 'live' };
      }
    } catch { /* fall through to the curated sample */ }
  }
  return { business: SAMPLE_BUSINESS, source: 'sample' };
}
