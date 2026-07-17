import { NextRequest, NextResponse } from 'next/server';
import { TEMPLATES, LAUNCH_STEPS } from '@/lib/nbf/business';
import { resolveBusiness } from '@/lib/nbf/server';

// GET /api/bff/nbf/business — the Business Foundation surface (C-124).
// NBF establishes a business identity (Day-1) and coordinates the owning apps
// (Zone verifies, Commerce sells, Titan is the graduation target). It never
// verifies, transacts, or holds capital. The caller's OWN business is resolved from
// the real NBF module (identity-service) via the gateway, keyed by the identity in
// the `tec_user` session cookie — NEVER a query param or body (P6). Templates + the
// launch funnel are static platform catalog. Falls back to the sample business.
function ownerFromSession(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value ?? '';
    if (!raw) return null;
    let u: Record<string, unknown>;
    try { u = JSON.parse(raw); } catch { u = JSON.parse(decodeURIComponent(raw)); }
    const owner = (u.piUsername ?? u.username) as string | undefined;
    return owner && owner.trim() ? owner : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const owner = ownerFromSession(req);
  const { business, source } = await resolveBusiness(owner);
  return NextResponse.json(
    { source, templates: TEMPLATES, business, launchSteps: LAUNCH_STEPS },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
