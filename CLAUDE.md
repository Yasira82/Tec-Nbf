# TEC NBF — Claude Code Instructions

> ⚡ **SESSION START:** اقرأ `knowledge-base/C-02___CURRENT_STATE_.md` + **app charter
> `knowledge-base/C-124___NBF_BUSINESS_FOUNDATION_RUNTIME.md`** من `yasira82/tec-knowledge-base` (branch: `main`).

## What This App Is

**The Business Foundation Runtime** of the Pi economy (C-124) — the **System of
Business Formation** (Network Business Foundation). NBF answers one question:

```
"How do I start my business in the Pi economy?"
```

Where Hub creates **personal** identity, NBF creates **business** identity — the
entity that transacts. NBF is **Business Day-1**; **Titan (C-130) is Business at
Scale**. A business **graduates** from NBF into Titan (team > 5 / revenue > 1,000π
/ active projects > 3 / customers > 500).

Built from `tec-template-base` (Next.js 15 frontend).

**Current Phase: NBF V0/V1 — Business Foundation preview (read-only).** Identity /
domain / slug / legal + a themed home (the **25-minute launch funnel** · **business
templates** · a sample verified business + **graduation-to-Titan** check) + a
`/template/[id]` detail page + **NBF Pro** (the Pi Portal "Process a Transaction"
gate). Real business creation is Phase 2 (needs Zone + Commerce live). Not deployed.

---

## Pi App Identity

| Field | Value |
|-------|-------|
| **App** | TEC NBF |
| **Domain** | `https://nbf.tecosystem.app` |
| **Pi App ID** | ⏳ TBD — register at Pi Developer Portal · then Vercel `NEXT_PUBLIC_PI_APP_ID` |
| **APP_SOURCE slug** | `nbf` (payment-service resolves `PI_API_KEY_NBF`) — set in `src/lib/app-source.ts` |
| **PI_SANDBOX** | `false` (Mainnet) |

---

## NBF-Specific Rules (C-124)

### The formation boundary — NBF establishes; the owning systems verify/transact/scale
NBF **OWNS**: business identity (name · type · handle · logo · Pi credentials),
business profile + catalog links, the business toolkit (QR / card / analytics view),
business templates, and the launch checklist. NBF does **NOT OWN**:
- **Verification** → Zone issues `VERIFIED_BUSINESS` (NBF presents it, never self-verifies).
- **Transactions** → Commerce / payment-service. **Capital** → FundX (C-113).
- **Enterprise operations** → Titan (C-130) — the graduation target, not the origin.
- **Reputation** → Legend (C-126). **Metrics** → Analytics (C-105). **Discovery** → Explorer (C-108).

### NBF vs Titan (constitutional separation)
NBF = establish → register → verify → launch → first customers (Day-1 → ~Year-1).
Titan = manage → scale → govern → optimize (Year-1 → maturity). **NBF graduates
INTO Titan; it does not compete with it.**

### Isolation (P6)
A user sees/edits their OWN businesses — identity from the `tec_user` session cookie
server-side, **never** a query param or request body. Public view (browsing a business
page) is allowed; creating/editing requires auth. No session → fail closed.

**Reference of record:** `yasira82/tec-knowledge-base` —
`C-124___NBF_BUSINESS_FOUNDATION_RUNTIME.md` (charter) + `C-12_Dual_Mode_Payment.md`
(payment anti-regression) + `C-123` (session/cookies).

---

## Stack

- Next.js 15 App Router + TypeScript strict · React 18
- `@yasser172/tec-ui` (design system) · `@yasser172/tec-auth` · `@yasser172/tec-sdk`
- Vitest (unit) + Playwright (e2e) · Deployment: Vercel

---

## Architecture Rules (non-negotiable)

### CSRF — middleware ONLY (P2 single source of truth)
CSRF is enforced in **`middleware.ts`** and **nowhere else**: a request is trusted
if the double-submit token matches **OR** it is first-party (Origin host === Host /
`*.tecosystem.app`).
- ❌ **NEVER** add a CSRF check inside a route handler (`csrfCookie !== csrfHeader`
  → 403). It 403's legit Mode-2 payments in Pi Browser (drops `sameSite=None`
  cookies). The CI `payment-policy` job fails the build if you do. (KB C-12 §11)
- ✅ A route may *forward* `x-csrf-token` to a downstream call; it must never *validate* it.

### ADR-007 — Dual-mode payment (Pi foreign session)
Every buy handler MUST guard before touching `window.Pi`:
```typescript
const isHubNavigation = () =>
  document.referrer.toLowerCase().includes('hub.tecosystem.app');
if (isHubNavigation() || !(window as any).Pi || !piReady) {
  redirectToHubPayment(...);   // Mode 1: Hub modal → /hub?pay=1&...
  return;
}
// Mode 2: standalone — createPaymentRecord() then createU2APayment() (src/lib/pi-payment.ts)
```
> NBF Pro (subscription) is the only buy flow. Approve under `PI_API_KEY_NBF`
> (never the default Hub key — the Analytics approve→502 lesson, C-12 §11).

### ADR-009 — Unified payment contract
`amount` is a **number**; gateway path is **`/api/payment/*`** (singular); the only
inter-service header is **`x-internal-key`** + `INTERNAL_SECRET`. Don't re-declare
payment Zod locally — shapes live in `@yasser172/tec-sdk`.

### Two-SDK boundary
```
Client components → src/lib-client/*  (browser state, Pi hooks)
API routes (BFF)  → @yasser172/tec-sdk via /api/bff/*  (server-only)
```

### Auth / cookies (LOCKED)
SSO via Hub cookies `tec_access_token`, `tec_csrf`, `tec_user`. Never localStorage.
Identity is derived from the `tec_user` cookie server-side — **never from the request body**.
> `NEXT_PUBLIC_HUB_URL` MUST be `https://hub.tecosystem.app` — the apex `tecosystem.app`
> is not the Hub → `ERR_CONNECTION_CLOSED` at login; redeploy after changing it.

---

## Setup status + Roadmap (C-124 §Build Protocol)

```
NBF V0/V1 — Business Foundation preview (customized from template):
  ✅ package.json name = tec-nbf · APP_SOURCE = 'nbf' (src/lib/app-source.ts)
  ✅ sso-callback ALLOWED_AUDIENCES → nbf.tecosystem.app + tec-nbf.vercel.app
  ✅ privacy + terms → TEC NBF / nbf.tecosystem.app
  ✅ NEW-A: no NEXT_PUBLIC_API_GATEWAY_URL / Railway host in the client bundle
  ✅ /app themed: 25-min launch funnel + business templates + sample business +
     graduation-to-Titan check + NBF Pro (real Pi U2A)
  ✅ /template/[id] detail + BFF /api/bff/nbf/business (sample, read-only)

Next (before live):
  □ Register Pi App ID (Pi Developer Portal) → Vercel NEXT_PUBLIC_PI_APP_ID +
    API_GATEWAY_URL · INTERNAL_SECRET · SSO_SECRET · NEXT_PUBLIC_HUB_URL=https://hub.tecosystem.app · PI_SANDBOX=false.
  □ payment-service: set PI_API_KEY_NBF on Railway (approve→502 otherwise, C-12 §11).
  □ Hub SSO: add nbf.tecosystem.app + tec-nbf.vercel.app to Hub /api/auth/sso
    ALLOWED_TARGETS + Hub domain registry.
  □ Deploy (Vercel) + runtime-verify login (C-123) + a real NBF Pro payment
    Mode 1 (Hub) AND Mode 2 (standalone).

NBF V1+ (post-Portal — C-124): real business profile creation (STORE + SERVICE +
  FREELANCER) → team invite → Zone verification request → Commerce catalog → QR +
  business page → graduation check to Titan. Gated on Zone + Commerce live + 1k users.
```

---

## What NOT To Do

- Do NOT self-verify businesses — Zone verifies (NBF presents the badge, never mints it)
- Do NOT process transactions or hold capital in NBF — Commerce/payment-service + FundX
- Do NOT compete with Titan — a business GRADUATES into Titan (C-124 → C-130)
- Do NOT validate CSRF in a route handler — middleware only (CI blocks it)
- Do NOT send `amount` as a string, or use `/payments` / `x-service-secret`
- Do NOT skip the ADR-007 `isHubNavigation()` guard before `window.Pi`
- Do NOT store tokens in localStorage; do NOT derive identity from the body
- Do NOT add `NEXT_PUBLIC_*` for internal service URLs or `INTERNAL_SECRET`
- Do NOT set `NEXT_PUBLIC_HUB_URL` to the apex `tecosystem.app` — use `hub.tecosystem.app`

---

## Commit Convention

```
feat(nbf):  new business-formation feature   fix(payment): payment flow fix (test carefully)
fix(nbf):   bug fix                          chore(scope):  build/config
```

---

## Skills

Available via plugin — invoke automatically when the situation matches:

| Situation | Skill |
|-----------|-------|
| Writing new feature or fixing a bug → use TDD | `/tdd` |
| Bug, regression, or unexpected behavior | `/diagnose` |
| Writing or modifying tests | `/test-guard` |
| Writing or modifying BFF routes, payment handlers, or API contracts | `/clean-code-guard` |
| Updating docs, CLAUDE.md, or knowledge-base entries | `/docs-guard` |
| Planning a new feature or architectural decision | `/grill-with-docs` |
| Breaking down a roadmap item into GitHub Issues | `/to-issues` |
| Session is getting long or context is filling up | `/handoff` |
| Adding pre-commit hooks to this repo | `/setup-pre-commit` |
