import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TEMPLATES, LAUNCH_STEPS, type BusinessType } from '@/lib/nbf/business';
import { resolveOwnBusiness, createBusinessBackend } from '@/lib/nbf/server';

// TEC NBF — Business Foundation surface (C-124).
//
// GET  → the caller's OWN business (identity from the session cookie, never a param
//        — P6), live backend first, curated sample when there is no session/backend.
//        Also serves the templates + launch funnel for the home shell.
// POST → establish a new business (DRAFT). The owner is the VERIFIED session identity:
//        the JWT is forwarded to the backend, which derives the owner from the token —
//        NEVER from the request body (P6).
//
// CSRF is enforced ONCE in middleware (double-submit OR first-party Origin).
// ⚠️ DO NOT add a CSRF check here — it 403's legit Mode-2 flows in Pi Browser. (KB C-12 §11)

const VALID_TYPES = TEMPLATES.map((t) => t.type) as [BusinessType, ...BusinessType[]];

const CreateSchema = z.object({
  name:    z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  type:    z.enum(VALID_TYPES),
  tagline: z.string().trim().max(140).optional(),
});

// The caller's Pi username (business owner key) from the tec_user session cookie.
function ownerFromSession(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('tec_user')?.value ?? '';
    if (!raw) return null;
    let u: Record<string, unknown>;
    try { u = JSON.parse(raw); } catch { u = JSON.parse(decodeURIComponent(raw)); }
    const owner = (u.piUsername ?? u.username ?? u.pi_username) as string | undefined;
    return owner && owner.trim() ? owner.trim() : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const owner = ownerFromSession(req);
  const { business, source } = await resolveOwnBusiness(owner);
  return NextResponse.json(
    { source, business, templates: TEMPLATES, launchSteps: LAUNCH_STEPS },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createBusinessBackend(token, parsed.data);
  if (result.ok) {
    return NextResponse.json({ business: result.business }, { status: 201 });
  }
  return NextResponse.json(
    { error: result.error ?? 'Create failed' },
    { status: result.status || 502 },
  );
}
