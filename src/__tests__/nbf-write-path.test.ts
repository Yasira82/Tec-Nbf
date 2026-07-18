// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// NBF write path (C-124) — establish + launch a business. These tests lock the
// contract: the owner is NEVER sent in the body (derived from the forwarded JWT by
// the backend, P6), reads fall back to the curated sample, validation fails closed,
// and backend status codes (401/409) pass through.

const GW = 'https://api.example.com';

const makeReq = (opts: {
  cookies?: Record<string, string>;
  body?:    unknown;
  method?:  string;
  url?:     string;
}) => {
  const cookieStr = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ')
    : '';
  const headers: Record<string, string> = {};
  if (cookieStr) headers['Cookie'] = cookieStr;
  return new NextRequest(opts.url ?? 'http://localhost/api/bff/nbf/business', {
    method:  opts.method ?? 'POST',
    headers,
    body:    opts.body ? JSON.stringify(opts.body) : undefined,
  });
};

const userCookie = JSON.stringify({ piUsername: 'pioneer' });

const backendBusiness = (over: Record<string, unknown> = {}) => ({
  owner: 'pioneer', handle: 'my-pi-shop', name: 'My Pi Shop', type: 'STORE',
  tagline: 'goods in Pi', status: 'DRAFT', zone_verified: false,
  profile_views: 0, pi_received: 0, customers: 0,
  team_size: 0, monthly_revenue_pi: 0, active_projects: 0, customer_count: 0,
  titan_ready: false, ...over,
});

const okJson = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => body,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_GATEWAY_URL = GW;
  process.env.INTERNAL_SECRET = 'secret';
});

describe('businessFromBackend (row mapping)', () => {
  it('maps snake_case → camelCase and derives titanReady when a threshold is exceeded', async () => {
    const { businessFromBackend } = await import('@/lib/nbf/server');
    const mapped = businessFromBackend(backendBusiness({
      pi_received: 500, monthly_revenue_pi: 2000, titan_ready: false,
    }));
    expect(mapped.handle).toBe('my-pi-shop');
    expect(mapped.zoneVerified).toBe(false);
    expect(mapped.analytics.piReceived).toBe(500);
    expect(mapped.graduation.monthlyRevenuePi).toBe(2000);
    expect(mapped.graduation.titanReady).toBe(true);   // 2000 > 1000 threshold
  });
});

describe('GET /api/bff/nbf/business', () => {
  it('serves the curated sample when there is no session (fail-safe, never blank)', async () => {
    const { GET } = await import('@/app/api/bff/nbf/business/route');
    const res  = await GET(makeReq({ method: 'GET' }));
    const data = await res.json();
    expect(data.source).toBe('sample');
    expect(data.business).toBeTruthy();
    expect(Array.isArray(data.templates)).toBe(true);
  });

  it("serves the caller's OWN live business when the backend has one", async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({ data: { business: backendBusiness({ status: 'ACTIVE' }) } }));
    const { GET } = await import('@/app/api/bff/nbf/business/route');
    const res  = await GET(makeReq({ method: 'GET', cookies: { tec_user: userCookie } }));
    const data = await res.json();
    expect(data.source).toBe('live');
    expect(data.business.status).toBe('ACTIVE');
    // owner came from the session cookie → into the by-owner path (never a body param)
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('/business/by-owner/pioneer');
  });
});

describe('POST /api/bff/nbf/business (establish)', () => {
  it('returns 401 when the access token is missing', async () => {
    const { POST } = await import('@/app/api/bff/nbf/business/route');
    const res = await POST(makeReq({ cookies: { tec_user: userCookie }, body: { name: 'My Pi Shop', type: 'STORE' } }));
    expect(res.status).toBe(401);
  });

  it('forwards the JWT as Bearer and sends NO owner in the body (P6)', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({ data: { business: backendBusiness() } }, 201));
    const { POST } = await import('@/app/api/bff/nbf/business/route');
    const res = await POST(makeReq({
      cookies: { tec_access_token: 'jwt-123', tec_user: userCookie },
      body:    { name: 'My Pi Shop', type: 'STORE', tagline: 'goods in Pi' },
    }));
    expect(res.status).toBe(201);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${GW}/api/identity/nbf/business`);
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
    expect(init.headers['x-internal-key']).toBe('secret');
    const sent = JSON.parse(init.body as string);
    expect(sent).toEqual({ name: 'My Pi Shop', type: 'STORE', tagline: 'goods in Pi' });
    expect(sent.owner).toBeUndefined();   // owner derived from the token, never the body
  });

  it('rejects an invalid body (short name) at the BFF — no backend call', async () => {
    global.fetch = vi.fn();
    const { POST } = await import('@/app/api/bff/nbf/business/route');
    const res = await POST(makeReq({ cookies: { tec_access_token: 'jwt-123' }, body: { name: 'x', type: 'STORE' } }));
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('passes a backend 409 (one business per owner) through to the caller', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({ message: 'You already have a business' }, 409));
    const { POST } = await import('@/app/api/bff/nbf/business/route');
    const res = await POST(makeReq({
      cookies: { tec_access_token: 'jwt-123' }, body: { name: 'Another Shop', type: 'STORE' },
    }));
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/bff/nbf/business/:handle/publish (launch)', () => {
  it('returns 401 without a token', async () => {
    const { PATCH } = await import('@/app/api/bff/nbf/business/[handle]/publish/route');
    const res = await PATCH(
      makeReq({ method: 'PATCH', url: 'http://localhost/api/bff/nbf/business/my-pi-shop/publish' }),
      { params: Promise.resolve({ handle: 'my-pi-shop' }) },
    );
    expect(res.status).toBe(401);
  });

  it('forwards a PATCH to the backend publish route and returns the ACTIVE business', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({ data: { business: backendBusiness({ status: 'ACTIVE' }) } }));
    const { PATCH } = await import('@/app/api/bff/nbf/business/[handle]/publish/route');
    const res = await PATCH(
      makeReq({ method: 'PATCH', cookies: { tec_access_token: 'jwt-123' }, url: 'http://localhost/api/bff/nbf/business/my-pi-shop/publish' }),
      { params: Promise.resolve({ handle: 'my-pi-shop' }) },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.business.status).toBe('ACTIVE');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GW}/api/identity/nbf/business/my-pi-shop/publish`);
    expect(init.method).toBe('PATCH');
  });
});
