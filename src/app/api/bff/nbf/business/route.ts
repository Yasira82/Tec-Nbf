import { NextResponse } from 'next/server';
import { TEMPLATES, SAMPLE_BUSINESS, LAUNCH_STEPS } from '@/lib/nbf/business';

// GET /api/bff/nbf/business — the Business Foundation surface (C-124), read-only.
// NBF establishes a business identity (Day-1) and coordinates the owning apps
// (Zone verifies, Commerce sells, Titan is the graduation target). It never
// verifies, processes transactions, or holds capital. This V1 serves a curated
// SAMPLE (source:'sample'); when live it serves the caller's OWN businesses
// (identity from the session cookie, never a param — P6).
export function GET() {
  return NextResponse.json(
    { source: 'sample', templates: TEMPLATES, business: SAMPLE_BUSINESS, launchSteps: LAUNCH_STEPS },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
