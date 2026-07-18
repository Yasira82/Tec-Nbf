import { NextRequest, NextResponse } from 'next/server';
import { publishBusinessBackend } from '@/lib/nbf/server';

// PATCH /api/bff/nbf/business/:handle/publish — launch a DRAFT business (→ ACTIVE).
// The owner is the VERIFIED session identity: the JWT is forwarded to the backend,
// which enforces owner-scope from the token (a caller may only publish their OWN
// business — P6). VERIFIED stays Zone's to mint; GRADUATED is the Titan trigger —
// neither is user-reachable here.
// CSRF is enforced ONCE in middleware — do NOT re-check it here (KB C-12 §11).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const token = req.cookies.get('tec_access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { handle } = await params;
  if (!handle) return NextResponse.json({ error: 'Missing handle' }, { status: 400 });

  const result = await publishBusinessBackend(token, handle);
  if (result.ok) {
    return NextResponse.json({ business: result.business }, { status: 200 });
  }
  return NextResponse.json(
    { error: result.error ?? 'Publish failed' },
    { status: result.status || 502 },
  );
}
