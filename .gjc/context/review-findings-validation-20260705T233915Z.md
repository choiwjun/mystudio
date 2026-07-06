# Context Snapshot: review-findings-validation

- Timestamp: 20260705T233915Z
- Task statement: Verify and analyze external review findings covering AI mocks, Vercel cron auth/method mismatch, login redirect security, duplicate auth, dependency hygiene, rate limiting, logging DoS, and related medium/low issues.
- Desired outcome: Produce an evidence-backed triage stating which findings are confirmed, partially confirmed, or overstated; identify severity/order; avoid product-code changes unless the user separately asks for remediation.

## Known facts/evidence

- `lib/hermes/service.ts:266`, `lib/content/service.ts:116`, and `lib/content/searchStructure.ts:39` instantiate `new MockAIAdapter()` directly.
- `.env.example` declares `AI_ADAPTER`, `OPENAI_API_KEY`, and `CLAUDE_API_KEY`, but repository search found no runtime usage outside docs/env examples. No real OpenAI/Claude adapter implementation was found in `lib/ai` during intake.
- `vercel.json` schedules `/api/hermes/scan`; `app/api/hermes/scan/route.ts` exports only `POST` and checks `x-cron-secret`; `proxy.ts` bypasses auth for this route only when `x-cron-secret` exists.
- `components/auth/LoginForm.tsx:32` redirects to `searchParams.get("from") ?? "/"` without same-origin/path validation.
- `auth.ts` and `app/api/auth/[...nextauth]/route.ts` mount NextAuth handlers; `proxy.ts` marks `/api/auth` public; app-specific auth reads custom JWT session helpers.
- `package.json` contains multiple `latest` dependencies and unused-looking `dompurify`/`pino`; `@playwright/test` is used by `scripts/capture-p0-visual.mjs`, so that part of the review may be overstated.
- `lib/auth/rateLimit.ts` uses module-local `Map`; `app/api/auth/login/route.ts` keys by email and first `x-forwarded-for` header value.
- `proxy.ts` records rejected unauthenticated API requests through `recordErrorLog()` before returning 401.
- `app/api/auth/login/route.ts` includes raw JWT `token` in the JSON success body while also setting an httpOnly cookie.
- `components/content/ContentPackageDetail.tsx` falls back to `demoPackageForId()` for non-401 API errors and displays `데모 데이터`.
- `proxy.ts` matcher skips paths containing dots: `/((?!.*\..*).*)`.
- `lib/security/cron.ts` compares secret strings with `!==` and only reads `x-cron-secret`.
- `lib/auth/owner.ts` falls back to `owner@example.com` when `OWNER_EMAIL` is unset.
- `.env.example` declares `SUPABASE_*`; no runtime storage implementation was confirmed in intake.
- `lib/hermes/rawItems.ts` falls back to previous/internal raw items when NAVER credentials are missing or API calls fail.

## Constraints

- Active Team skill operator contract requires `gjc team ...` launch from tmux after this grounded snapshot.
- This run is analysis/validation-focused, not remediation, unless the user explicitly requests fixes.
- Use concrete file/state evidence; do not claim completion without team status/shutdown evidence.

## Unknowns/open questions

- Whether the product intentionally allows demo/mock mode for local development vs production; current env does not enforce fail-fast.
- Whether Vercel Cron in the deployed plan sends Authorization bearer automatically or relies on Vercel-managed `CRON_SECRET`; verify against current Vercel docs if remediation is requested.
- Whether any route containing dots lacks its own guard; medium risk depends on future route additions.
- Whether external storage/export features are intentionally out of scope for the current phase.

## Likely codebase touchpoints

- `lib/ai/*`, `lib/hermes/service.ts`, `lib/content/service.ts`, `lib/content/searchStructure.ts`
- `app/api/hermes/scan/route.ts`, `lib/security/cron.ts`, `proxy.ts`, `vercel.json`
- `components/auth/LoginForm.tsx`, `app/api/auth/login/route.ts`, `lib/auth/session.ts`, `lib/auth/rateLimit.ts`, `lib/auth/owner.ts`, `auth.ts`, `app/api/auth/[...nextauth]/route.ts`
- `package.json`, `package-lock.json`, `.env.example`, `.gitattributes`
- `components/content/ContentPackageDetail.tsx`, `lib/hermes/rawItems.ts`
