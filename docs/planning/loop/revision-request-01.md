# Revision Request 01 — Round 1 (2026-07-02T09:44)

> 근거: `docs/planning/loop/planning-loop-report.md`, `document-gap-report.md` (Round 1)
> 원칙: 전체 재생성 금지 — 지목된 섹션만 패치, 나머지 보존.

## R1. [하드페일] 04-database-design.md — DB 설계를 리소스 계약과 정렬

- **문제**: 화면·태스크·resources.yaml이 요구하는 항목이 DB 설계에 없음.
- **수정 지시**:
  1. 누락 테이블 3개 추가: `exports`, `title_candidates`, `hq_briefing` (필드는 `specs/domain/resources.yaml`의 해당 리소스 fields 기준)
  2. 누락 필드 추가: `drafts.comparison_table`, `drafts.faq`, `drafts.first_screen`, `content_packages.progress`, `content_packages.published_at`, `opportunity_memos.risk_score`, `opportunity_memos.score_reasons`
  3. Prisma 문법 오류 수정: `OpportunitMemo` 오탈자 → `OpportunityMemo`, `String[]?` → `String[]` (Prisma는 optional list 불가), 누락된 역방향 relation 전부 추가
  4. 점수 필드 네이밍 통일: `*Fit` → resources.yaml 기준 `homefeed_score/search_score/revenue_score/risk_score` (@map 사용)
- **담당 라우팅**: docs-specialist (patch 모드)

## R2. [충돌] 06-tasks.md — 프로젝트 요약 및 집계 수정

- **문제**: 상단 요약이 "홈플러스·쿠팡 판매자 플랫폼"으로 기술 — 01-prd(1인 AI 미디어커머스 OS)와 정면 충돌. 총 태스크 "27개"는 오기(실제 24개).
- **수정 지시**: 요약 3줄을 01-prd 제품 정의로 교체, 태스크 집계 24개로 정정 (P0:2/P1:3/P2:7/P3:5/P4:7).
- **담당 라우팅**: tasks-generator patch (실행: docs-specialist)

## R3. [3원화] 상태값 머신 단일화

- **문제**: `00-source-plan §10`(canonical) vs `specs/shared/types.yaml PackageStatus` vs `06-tasks`의 `awaiting_export`(미정의) — 3곳이 서로 다름.
- **수정 지시**: `00-source-plan.md §10`을 단일 기준으로: types.yaml PackageStatus를 §10 상태값+예외 상태로 정확히 일치시키고, 06-tasks의 `awaiting_export` 등 미정의 상태를 §10 용어로 치환.
- **담당 라우팅**: screen-spec patch + tasks-generator patch (실행: docs-specialist)

## R4. [누락] content-detail.yaml — 검수 차단 시나리오 추가

- **문제**: P3-S1-V가 필수 지정한 "high risk 시 Export 비활성화" 테스트가 화면 yaml tests에 없음.
- **수정 지시**: tests에 추가 — "name: 검수 실패 시 Export 차단 / when: compliance_checks.risk_level=high / then: [Export 버튼 비활성, export_allowed=false 안내 표시, [수정하고 다시 검수] 버튼 노출]"
- **담당 라우팅**: screen-spec patch (실행: docs-specialist)

## R5. [누락/불일치] 06-tasks.md cron 태스크 + 표기 통일

- **문제**: TRD의 "매일 06:00 Hermes 스캔(Vercel Cron)" 등록 태스크 부재. clicks 필수/선택이 03-user-flow/performance.yaml/P4-S2 간 불일치.
- **수정 지시**:
  1. P2-R1 acceptance에 Vercel Cron 등록(`vercel.json` crons, 매일 06:00 KST) 항목 추가 (새 태스크 대신 P2-R1 범위 확장)
  2. clicks 표기 통일: performance.yaml 기준 "필수"로 — 03-user-flow와 06-tasks P4-S2를 필수로 정정
  3. stale 기준 "7일" 표기를 04/resources.yaml/06-tasks에서 동일 문구로 통일
- **담당 라우팅**: tasks-generator patch + socrates(03) patch (실행: docs-specialist)

---
처리 상태: **완료** (2026-07-02 10:52, R1~R5 전체 실행 + 감독관 후속 패치 5건 — planning-loop-report.md Round 2 참조)
