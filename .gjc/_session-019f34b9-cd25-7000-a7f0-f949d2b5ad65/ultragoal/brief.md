Original constraints: implement every item from the latest docs-vs-source gap analysis recommendation list. Preserve fail-closed security behavior, avoid reverting unrelated user work, use Team/native role agents for big scope, and verify each story before checkpointing.

@goal: Live HQ and Performance status UX
Replace hardcoded HQ/header/performance status strings with live hq_status, AI budget, and needs_performance_log values from authoritative backend status APIs. The AppHeader, HQ home topbar, and Performance page/recorder must display current counts/status and preserve documented UX.

@goal: Editor autosave recovery
Implement session-expiry/transient-failure draft autosave preservation for content package editing. Failed autosave content must be saved locally, restored after reload/relogin, resendable, and cleared only after successful persistence.

@goal: Compliance and HQ AI governance integration
Add adapter-backed compliance semantic review while preserving rule-engine authority, connect active policy_rules into compliance governance, use runtime AI adapter for HQ daily briefing generation, and record real AI adapter/model identity in cost logs.

@goal: Product import and manual product completion
Complete product URL import/manual fallback semantics by safely enriching or explicitly bounded parsing and adding missing manual fields for product_url, image_url, and source while preserving SSRF protections.

@goal: Generation context and documentation drift
Connect PromptTemplate/CategoryPlaybook to generation context where useful or mark them explicitly deferred, and update planning docs that still describe NextAuth instead of the implemented jose signed-cookie session model.

@goal: Final verification and durable reconciliation
Run focused and full verification, cleanup/review/QA gates, checkpoint every story with structured evidence, and reconcile inline goal state only after a fresh final aggregate receipt exists.
