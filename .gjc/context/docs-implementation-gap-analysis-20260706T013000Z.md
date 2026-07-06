# Context Snapshot: docs-implementation-gap-analysis

- Timestamp: 20260706T013000Z
- Task statement: Read/study all documents under `docs/` and investigate/analyze all development gaps, missing implementations, and incomplete requirements against the current codebase.
- Desired outcome: Produce an evidence-backed gap analysis that maps docs requirements to implemented, partially implemented, missing, or drifted code; include likely files/routes/models/tests and severity/priority. This is analysis only unless a later user request asks for remediation.

## Known facts/evidence

- Canonical source doc: `docs/planning/00-source-plan.md` states Paperclip Company OS v0.7 is the source of truth and defines an MVP loop: Hermes opportunity memos, four-axis scoring, HomeFeed/Search structures, ShoppingConnect links, blog draft, Naver Clip/SNS variants, Compliance Gate, Export bundle, Performance Logger, Company Memory.
- Implementation roadmap: `docs/planning/06-tasks.md` defines P0-P4, 24 tasks, and resource/screen acceptance criteria. It still contains several older assumptions (e.g. NextAuth.js, Naver fallback behavior, DOMPurify) that may intentionally differ from latest security remediation and must be classified as doc/code drift rather than blindly treated as missing.
- Recent remediation already changed security/production behavior: AI adapter selection now fails closed, Hermes raw item collection no longer fabricates fallback inputs, cron/auth/login/session/proxy were hardened, duplicate NextAuth was removed, content detail real API failures no longer fall back to demo data, and dependencies were pinned/removing dompurify/pino/next-auth.
- Current tests include contract coverage under `tests/` for P0-P4 plus screen contracts. Full `npm test` previously passed 81 tests after remediation.
- Docs include Markdown sources under `docs/planning/**` and generated HTML duplicates under `docs/_html/**`; workers should prioritize Markdown sources, use HTML only to catch generated/report content not present in Markdown.

## Constraints

- Use Team for read-only coordinated analysis. Workers must not mutate product code, `.gjc/_session-*/ultragoal`, or goal state.
- Do not call `gjc ultragoal checkpoint` from workers.
- Avoid treating recent security remediation as regression merely because older docs mention NextAuth.js, dummy fallbacks, or DOMPurify. Mark these as intentional security drift when evidence supports it.
- Produce concrete evidence: doc path/section plus current code/test path.

## Unknowns/open questions

- Which doc requirements are MVP/P0-P4 vs Phase 2/later exclusions.
- Whether generated `docs/_html` contains any content not mirrored in Markdown source.
- Whether UI screens match the latest `specs/screens/*.yaml` and docs screen contracts.
- Whether database model completeness implies feature completeness for all documented resources.

## Likely codebase touchpoints

- Docs: `docs/planning/00-source-plan.md`, `01-prd.md`, `02-trd.md`, `03-user-flow.md`, `04-database-design.md`, `05-design-system.md`, `06-screens.md`, `06-tasks.md`, `07-coding-convention.md`, `08-business-model.md`, `09-personas.md`, `10-desire-map.md`, `council-report.md`, `docs/planning/loop/*`, `docs/planning/vision/*`, and generated `docs/_html/**`.
- Specs: `specs/domain/resources.yaml`, `specs/screens/*.yaml`, `specs/shared/*.yaml`.
- Product code: `app/**`, `components/**`, `lib/**`, `prisma/schema.prisma`, `prisma/seed.ts`, `vercel.json`, `package.json`, `tests/**`.
