import {
  SAMPLE_BUSINESS, isTitanReady,
  type BusinessProfile, type BusinessType, type BusinessStatus,
} from './business';

// Server-only NBF backend access (C-124). Talks to the real NBF module
// (tec-identity-service) through the gateway. READS serve the caller's OWN
// business (owner derived from the session by the BFF — never a client param, P6);
// WRITES forward the caller's verified JWT as `Authorization: Bearer` so the
// backend resolves the owner from the token itself (never the body). Everything
// degrades to the curated sample so the page is never blank / never 500s.
// NEW-A: the gateway URL is server-only (API_GATEWAY_URL) — never shipped to the client.
const GW = process.env.API_GATEWAY_URL ?? '';

const gwHeaders = (token?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'x-request-id': crypto.randomUUID(),
  ...(token && { Authorization: `Bearer ${token}` }),
  ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
});

const num = (v: unknown) => Number(v ?? 0);

// Map a backend nbf_businesses row → the frontend BusinessProfile shape.
export function businessFromBackend(b: Record<string, unknown>): BusinessProfile {
  const graduation = {
    teamSize:         num(b.team_size),
    monthlyRevenuePi: num(b.monthly_revenue_pi),
    activeProjects:   num(b.active_projects),
    customerCount:    num(b.customer_count),
    titanReady:       false,
  };
  graduation.titanReady = Boolean(b.titan_ready) || isTitanReady(graduation);
  return {
    handle:       String(b.handle ?? ''),
    name:         String(b.name ?? ''),
    type:         String(b.type ?? 'STORE') as BusinessType,
    tagline:      String(b.tagline ?? ''),
    status:       String(b.status ?? 'DRAFT') as BusinessStatus,
    zoneVerified: Boolean(b.zone_verified),
    analytics: {
      profileViews: num(b.profile_views),
      piReceived:   num(b.pi_received),
      customers:    num(b.customers),
    },
    graduation,
  };
}

export interface ResolvedBusiness {
  business: BusinessProfile | null;
  // 'live'   → the caller's real business (they have one)
  // 'empty'  → live backend reached, caller has NO business yet (show the create form)
  // 'sample' → no session / no backend → curated preview
  source: 'live' | 'empty' | 'sample';
}

// The caller's OWN business — live backend first, curated sample as fallback.
// `owner` is derived from the session by the BFF (never a client param, P6).
export async function resolveOwnBusiness(owner: string | null): Promise<ResolvedBusiness> {
  if (GW && owner) {
    try {
      const res = await fetch(
        `${GW}/api/identity/nbf/business/by-owner/${encodeURIComponent(owner)}`,
        { headers: gwHeaders(), cache: 'no-store' },
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const b = data?.data?.business;
        if (b) return { business: businessFromBackend(b as Record<string, unknown>), source: 'live' };
        return { business: null, source: 'empty' };  // reached backend, none yet
      }
    } catch { /* fall through to the curated sample */ }
  }
  return { business: SAMPLE_BUSINESS, source: 'sample' };
}

export interface WriteResult {
  ok: boolean;
  status: number;
  business?: BusinessProfile;
  error?: string;
}

// Establish a new business (DRAFT). The owner is the VERIFIED session identity,
// resolved by the backend from the forwarded JWT — NEVER sent in the body (P6).
export async function createBusinessBackend(
  token: string,
  dto: { name: string; type: string; tagline?: string },
): Promise<WriteResult> {
  if (!GW) return { ok: false, status: 503, error: 'Gateway not configured' };
  try {
    const res = await fetch(`${GW}/api/identity/nbf/business`, {
      method:  'POST',
      headers: gwHeaders(token),
      body:    JSON.stringify(dto),   // name/type/tagline only — owner comes from the token
      cache:   'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.data?.business) {
      return { ok: true, status: res.status, business: businessFromBackend(data.data.business) };
    }
    return { ok: false, status: res.status, error: String(data?.message ?? data?.error ?? 'Create failed') };
  } catch (err) {
    return { ok: false, status: 503, error: (err as Error).message };
  }
}

// Launch a DRAFT business → ACTIVE. Owner-scoped in the backend (a caller may only
// publish their OWN business — verified from the forwarded JWT, P6).
export async function publishBusinessBackend(token: string, handle: string): Promise<WriteResult> {
  if (!GW) return { ok: false, status: 503, error: 'Gateway not configured' };
  try {
    const res = await fetch(
      `${GW}/api/identity/nbf/business/${encodeURIComponent(handle)}/publish`,
      { method: 'PATCH', headers: gwHeaders(token), cache: 'no-store' },
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.data?.business) {
      return { ok: true, status: res.status, business: businessFromBackend(data.data.business) };
    }
    return { ok: false, status: res.status, error: String(data?.message ?? data?.error ?? 'Publish failed') };
  } catch (err) {
    return { ok: false, status: 503, error: (err as Error).message };
  }
}
