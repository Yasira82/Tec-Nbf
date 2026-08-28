// TEC NBF — Business Foundation Runtime (C-124) — read-only V1 data.
//
// NBF = System of Business Formation: any Pi user establishes, verifies, and
// launches a business identity ("How do I start my business in the Pi economy?").
// Where Hub creates PERSONAL identity, NBF creates BUSINESS identity — the entity
// that transacts. NBF is Business Day-1; Titan (C-130) is Business at Scale — a
// business GRADUATES from NBF into Titan.
//
// NBF OWNS: business identity + profile + templates + toolkit + launch checklist.
// NBF does NOT OWN: transaction processing (Commerce/payment-service), capital
// (FundX), verification (Zone — presented, never minted), enterprise ops (Titan),
// reputation (Legend), analytics (Analytics). This V1 is a curated read-only
// SAMPLE; when live it serves the caller's OWN businesses (identity from the
// session cookie, never a param — P6).

export type BusinessType =
  | 'STORE' | 'SERVICE' | 'STARTUP' | 'FREELANCER' | 'NGO' | 'RESTAURANT' | 'AGENCY';

// DRAFT → ACTIVE → VERIFIED → GRADUATED (into Titan)
export type BusinessStatus = 'DRAFT' | 'ACTIVE' | 'VERIFIED' | 'GRADUATED';

export interface BusinessTemplate {
  type:        BusinessType;
  label:       string;
  icon:        string;
  description: string;
  checklist:   string[];
}

export interface GraduationCheck {
  teamSize:         number;
  monthlyRevenuePi: number;
  activeProjects:   number;
  customerCount:    number;
  titanReady:       boolean;   // true if any threshold exceeded (C-124 → C-130)
}

export interface BusinessProfile {
  handle:       string;
  name:         string;
  type:         BusinessType;
  tagline:      string;
  status:       BusinessStatus;
  zoneVerified: boolean;       // presented from Zone — never minted here
  analytics:    { profileViews: number; piReceived: number; customers: number };
  graduation:   GraduationCheck;
}

// The 25-minute launch funnel (C-124).
export const LAUNCH_STEPS: { title: string; minutes: number; note: string }[] = [
  { title: 'Choose a template',       minutes: 5,  note: 'Pre-filled profile from a business type.' },
  { title: 'Complete profile',        minutes: 10, note: 'Name · description · category · logo · team · Pi payment.' },
  { title: 'Add a product/service',   minutes: 10, note: 'At least one, with Pi pricing (listed in Commerce).' },
  { title: 'Zone verification',       minutes: 0,  note: 'Async 1–7 days — Zone issues VERIFIED_BUSINESS (NBF never self-verifies).' },
  { title: 'Launch',                  minutes: 0,  note: 'Public page + QR code; appears in Explorer.' },
];

export const TEMPLATES: BusinessTemplate[] = [
  { type: 'STORE',      label: 'Pi Store',        icon: '🛍️', description: 'Retail / ecommerce storefront selling in Pi.',          checklist: ['Catalog', 'Pi payment', 'Shipping/pickup', 'Zone verification'] },
  { type: 'SERVICE',    label: 'Service Business', icon: '🧰', description: 'Freelancer / consulting — book and get paid in Pi.',    checklist: ['Service list', 'Pi pricing', 'Availability', 'Zone verification'] },
  { type: 'RESTAURANT', label: 'Food & Beverage',  icon: '🍽️', description: 'Restaurant / café accepting Pi.',                       checklist: ['Menu', 'Pi payment', 'Hours + location', 'Zone verification'] },
  { type: 'STARTUP',    label: 'Startup',          icon: '🚀', description: 'Tech / innovation venture — build toward FundX + Epic.', checklist: ['Pitch', 'Team', 'Milestones', 'Zone verification'] },
  { type: 'FREELANCER', label: 'Freelancer',       icon: '🧑‍💻', description: 'Solo creator / developer offering Pi-priced work.',    checklist: ['Portfolio', 'Rates', 'Contact', 'Zone verification'] },
  { type: 'NGO',        label: 'Non-Profit',       icon: '🤲', description: 'Community / social-impact organization on Pi.',         checklist: ['Mission', 'Programs', 'Transparency', 'Zone verification'] },
  { type: 'AGENCY',     label: 'Agency',           icon: '🏛️', description: 'Multi-service agency with a team.',                     checklist: ['Services', 'Team', 'Case studies', 'Zone verification'] },
];

// Sample established business (read-only preview).
export const SAMPLE_BUSINESS: BusinessProfile = {
  handle: 'pistore',
  name: 'Pi Corner Store',
  type: 'STORE',
  tagline: 'Everyday goods, paid in Pi.',
  status: 'VERIFIED',
  zoneVerified: true,
  analytics: { profileViews: 1240, piReceived: 860, customers: 74 },
  graduation: { teamSize: 3, monthlyRevenuePi: 420, activeProjects: 1, customerCount: 74, titanReady: false },
};

export const STATUS_META: Record<BusinessStatus, { label: string; tone: string }> = {
  DRAFT:     { label: 'Draft',     tone: '#8B5CF6' },
  ACTIVE:    { label: 'Active',    tone: '#3B82F6' },
  VERIFIED:  { label: 'Verified',  tone: '#22C55E' },
  GRADUATED: { label: 'Graduated → Titan', tone: '#FBB44A' },
};

// Graduation trigger (C-124 → Titan C-130): any threshold exceeded.
export const GRADUATION_THRESHOLDS = { teamSize: 5, monthlyRevenuePi: 1000, activeProjects: 3, customerCount: 500 };

export function getTemplate(type: string): BusinessTemplate | null {
  return TEMPLATES.find((t) => t.type === type) ?? null;
}

export function isTitanReady(g: GraduationCheck): boolean {
  return g.teamSize > GRADUATION_THRESHOLDS.teamSize
    || g.monthlyRevenuePi > GRADUATION_THRESHOLDS.monthlyRevenuePi
    || g.activeProjects > GRADUATION_THRESHOLDS.activeProjects
    || g.customerCount > GRADUATION_THRESHOLDS.customerCount;
}
