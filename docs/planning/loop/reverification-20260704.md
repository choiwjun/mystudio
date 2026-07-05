# Re-verification Report (2026-07-04)

> planning-loop-supervisor 재검증. 최종 승인(2026-07-02, Ready) 이후 문서 변경 없음 —
> 4개 클러스터(제품/기술/UX/태스크·게이트) 병렬 신선 재검증 + 감독관 직접 원문 대조.

## 1. 결론

- **판정 유지: Ready (with Risks)** — 신규 발견은 전부 비차단 문서 드리프트이나,
  **P3/P4 착수 전 수정 권장 3건**이 있다 (아래 §2 F-1~F-3).
- 이전 라운드 패치 항목은 전부 반영 확인: keyword_clusters `opportunity_memo_id` 단일화(04:207),
  decision `on_hold`(06-tasks:279), stale 7일 정렬(03 + products.yaml:96), relation @map/String[] 일관.
- REQ-001~013 전부 태스크 매핑 유지, 게이트 전부 측정 가능(비측정 기준 0건).

## 2. 신규 확인 결함 (감독관 원문 대조 완료)

| ID | 심각도 | 내용 | 근거 | 수정 위치 |
|---|---|---|---|---|
| F-1 | High | CostLog 필드 누락 — 02-trd §5가 `pipeline_step`·`blocked_by_cap`을 "새로 추가"로 명시했으나 04 CostLog에 미반영. 비용 서킷브레이커(A2) 구현 시 스키마 결함 | 02-trd:505-506 ↔ 04:472-483 | 04-database-design.md CostLog |
| F-2 | High | CompanyMemory 어휘 3원화 — 02-trd는 `pattern_type` enum {homefeed_hook, search_keyword, product_angle, pricing_strategy, seasonal_theme} + `pattern_text`/`tags`, 04는 `memoryType` "winning_hook/winning_product/failure_pattern", 06-tasks:501은 `memory_type: 'hook_type'`. REQ-012 게이트 판정 시 정본 불명 | 02-trd:310-322 ↔ 04:507 ↔ 06-tasks:501 | 02/04/06-tasks 중 정본 확정 후 정렬 |
| F-3 | Medium | content_packages API 계약의 `opportunity_memo_id` — resources.yaml은 응답 필드로 명시하나 04 ContentPackage는 `paperclip_decision_id` 경유만 있고 파생(조인) 주석 없음. 구현자가 컬럼 추가/조인 중 무엇인지 알 수 없음 | resources.yaml:70 ↔ 04:218-248 | 04에 파생 주석 또는 resources.yaml에 derived 표기 |
| F-4 | Medium | content-detail.yaml 편집 탭에 [저장][취소] 버튼 정의 잔존 — 06-screens D5 결정("자동 저장만, [저장][취소] 제거")과 모순. yaml 내부에서도 저장 버튼 trigger가 "자동 저장 2초"로 자기모순 | content-detail.yaml:129-134 ↔ 06-screens:765,773 | content-detail.yaml actions 정리 |
| F-5 | Low | E1 가드 UI 표현 3문서 불일치 — hq-main.yaml "/settings 리디렉트" vs 03-user-flow "팝업 경고+[설정하기]" vs settings.yaml "모달 알림" | hq-main.yaml:96 / 03:584 / settings.yaml:15 | UX 패턴 1개로 단일화 |
| F-6 | Low | 06-tasks.md 헤더 "총 Phase: 4개 (P0~P4)" — 실제 5개. 표기 오류(구조 자체는 정상) | 06-tasks:5 ↔ :562 | 06-tasks 헤더 |
| F-7 | Low | ComplianceCheck — resources.yaml은 `issues[]` 중첩 계약, 04는 ComplianceIssue 별도 테이블. 계약↔스키마 파생 관계 주석 없음 | resources.yaml:127-139 ↔ 04:381-397 | 04에 "API 응답에서 issues[]로 직렬화" 주석 |

**오탐 기각**: drafts `body_html`은 resources.yaml field_note가 "E5 — Export 경계에서만 생성, 저장하지 않음"으로
04의 bodyHtml 컬럼 폐지(B2)와 정합 — 불일치 아님.

## 3. 기존 리스크 재확인 (변동 없음 + 세부 추가)

1. **08-business-model 수익 자기모순 유지** — 계산 결과 ₩6,000/월(:109) vs Month 1~3 재정 리스트 ₩500,000/월(:270), 약 83배 격차.
   신규 세부: 간접 실적 ₩200,000(:271)의 계산 근거 부재(수수료율 1.8%만 명시). 사업 가정 — 2주 실측 후 재평가.
2. **P3-R1 과대** — 7 엔드포인트 + AI 생성 7종. 빌더 내부 3분할 권고 유지(00-loop.md §2).
3. **로딩/빈/에러 상태** — 5화면 전부 화면 레벨 미정의(05 토큰/토스트 일반 규칙만 존재). 구현 시 05 기본값 흡수 가능.
4. **네이버 검색 API 쿼터/정확도 미검증** — P0-T2 실측. 신규 세부: Day-1 폴백 공백(첫 스캔엔 "이전 결과" 없음 — 시드 전략 미정, 00-source-plan:787).
5. **council 잔여 쟁점 5건(§4-3/4/5/7/8) 비차단 유지** — §4-6(P2-S1 URL 상품등록 존속)은 2026-07-05에 "존속 + SSRF 방어 + 수동 폴백"으로 결정됨.

## 4. 기획 레벨 신규 모호점 (비차단, 기록)

- 성과 기록 타이밍 — 09-personas "저녁 5분" vs 게시 2시간 후 데이터 가용 (09:162-169)
- Paperclip HQ 역할 경계 — AI 자동 판단 레이어 vs 사용자 조작 인터페이스 표현 혼재 (00:36,232-250 / 01:66)
- "게시 준비 완료"의 정의(Export까지? 승인까지?) 불명 (01:164)
- Phase 2 진입 시 "채널 수 조정"의 우선순위 기준 미정 (00:18)
- AI 모델 선택 Open Question이 council 미합의 목록에 부재 (00:16)

## 5. 수정 실행 결과 (2026-07-04, 사용자 승인 후 감독관 직접 패치)

**F-1~F-7 전건 수정 완료** + 수정 중 추가 발견 1건(F-8) 동시 수정:

| ID | 수정 내용 |
|---|---|
| F-1 | 04 CostLog에 `pipelineStep`·`blockedByCap` 추가 + 인덱스 (02-trd §5 A2 정렬) |
| F-2 | **정본 = 02-trd §2.6 A9 확정.** 04 CompanyMemory → patternType(5종 enum)/patternText + A9 통계·가시성 필드(avgViews·avgClicks·avgRevenueUsd·createdPatternIds·usedInRecommendations·updatedAt) 추가, SQL 인덱스 정렬. resources.yaml·06-tasks:501·00-source-plan:454 동일 어휘로 정렬. user_id는 §4-3 대기로 미포함(주석 명시) |
| F-3 | 04 ContentPackage + resources.yaml 양쪽에 opportunity_memo_id 조인 파생 주석 |
| F-4 | content-detail.yaml 편집 탭 [저장][취소] 제거, undo만 유지 + D5 자동저장 note |
| F-5 | hq-main.yaml E1 가드 → "모달 경고 + [설정하기] → /settings" (03-user-flow 예외 5 정본) |
| F-6 | 06-tasks 헤더 "총 Phase: 5개" 정정 |
| F-7 | 04 ComplianceCheck에 issues[] 직렬화 주석 |
| **F-8** | (수정 중 발견) hq-main.yaml:99 `create decision (hold)` → `(on_hold)` — 이전 라운드 06-tasks만 고치고 yaml 누락분 |

**검증**: 정본 문서 전체 grep 스윕 — `memory_type`/`(hold)`/`save_draft` 잔존 0건 (loop/ 이력 리포트 제외).

## 6. 잔여 액션 (수정 후)

- **완료(2026-07-05)**: council §4-6 (P2-S1 URL 상품등록 존속) — 기능 존속 + SSRF 방어 + 수동 입력 폴백
- **완료(2026-07-05)**: 누락된 `specs/` 계약 복구 — `specs/domain/resources.yaml`, `specs/shared/types.yaml`, `specs/shared/components.yaml`, `specs/screens/*.yaml`
- 08-business-model 수익 가정 — 2주 실측 후 재평가 (문서 수정 아닌 사업 검증)
- 로딩/빈/에러 상태 — 구현 시 05 디자인 시스템 기본값 흡수
- P3-R1 — 빌더 내부 3분할
- 빌드 진입 시 완료 정의는 기존대로 `00-loop.md` + `08-derived-gates.md`.
