# 08-derived-gates.md — Paperclip Company OS 파생 게이트

> 산출: `docs/planning/loop/08-derived-gates.md` (LOOP 9, 2026-07-02)
> 이 문서는 이 프로젝트의 설계서에서 **직접 파생된** 세부 검증 기준이다.
> 다운스트림 개발 루프(auto-orchestrate / verification-before-completion / 독립 verifier)는
> `00-loop.md` + 이 문서를 **함께** 완료 기준으로 삼는다.
> **Hard / Metric / Domain 게이트를 증거와 함께 통과하기 전까지 어떤 Task/Phase도 "구현 완료" 선언 불가.**

## Project
- 프로젝트 이름: Paperclip Company OS v0.7 — 1인 AI 미디어커머스 운영 OS

## Generated From
- PRD: `docs/planning/01-prd.md` (기능 13개 §5, 운영 원칙 §4, 성공 기준 §7)
- TRD: `docs/planning/02-trd.md` (스택, AI 어댑터 §5, 성능 기준 §9)
- User Flow: `docs/planning/03-user-flow.md` (성공 15단계, 예외 흐름 4종)
- Database Design: `docs/planning/04-database-design.md` (Prisma 28모델 — Round 2 정렬본 + 2026-07-04 재검증 패치(CostLog·CompanyMemory) + workspaces 전방 호환)
- Design System: `docs/planning/05-design-system.md` ("하루 30분" 1원칙)
- Screens: `docs/planning/06-screens.md` + `specs/screens/*.yaml` (5화면 + tests 16종)
- Tasks: `docs/planning/06-tasks.md` (24개, P0~P4)
- Coding Convention: `docs/planning/07-coding-convention.md`
- Domain Contract: `specs/domain/resources.yaml` (리소스 17개 — **필드/엔드포인트 정본**)
- 공통 참고: 테스트 러너는 설계서에 미확정 — P0-T1에서 확정(권고: Vitest + Playwright). 아래 `hookable:` 명령은 러너 확정 후 경로만 치환.

---

## Requirement Gate Map

### REQ-001: Paperclip HQ 메인 (Command Center)

#### Source
- PRD §5-1 ("4개 블록 + 우측 패널 표시") / User Flow §1 2단계 / `specs/screens/hq-main.yaml` / Data: hq_briefing·hq_status·opportunity_memos·content_packages / Tasks: P4-R1, P4-S1(+V)

#### Hard Gates
- HG-001-1: Given 로그인된 오너 / When `/` (HQ) 접속 / Then 4개 블록(경영 브리핑, Hermes Memo 카드, 제작 파이프라인 칸반, Winning Patterns) + 우측 패널(승인 대기열·검수 알림·수익 스냅샷·갱신 필요) + 좌측 부서 사이드바 렌더
- HG-001-2: Given content_packages에 status가 서로 다른 패키지 3건 / When 칸반 로드 / Then 각 패키지가 types.yaml 칸반 매핑표의 올바른 컬럼에 표시 + progress 게이지 렌더
- HG-001-3: Given `GET /api/hq/today`·`GET /api/hq/status` 호출 / When 정상 응답 / Then 통일 응답 포맷(TRD §6) + 200

#### Metric Gates
- MG-001-1: HQ 메인 로딩 < 2초 (TRD §9)
- MG-001-2: hq-main.yaml tests 3종 전부 자동테스트로 구현·통과   hookable: `npm test -- hq-main`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | PRD §5-1 4블록+우측 패널 완전성 | 4/5 이상 |
| User Flow Fit | 아침 접속→기회 확인 동선 (03 §1 1~3단계) | 4/5 이상 |
| UI Consistency | 05-design-system 토큰·상태 라벨 색 준수 | 3/5 이상 |
| Maintainability | 블록별 컴포넌트 분리 | 3/5 이상 |

#### Domain Gates
- DG-001-1: 상태 라벨 색상 = 05 §1 규칙과 types.yaml 상태별 색상 정의 일치
- DG-001-2: 하루 30분 원칙 — HQ에서 오늘 주제 선택까지 추가 입력 0개 (클릭만으로 도달)

#### Evidence Required
- 테스트 실행 결과 / 변경 파일 목록 / HQ 스크린샷 또는 렌더 트리 설명 / 남은 리스크

---

### REQ-002: Hermes Opportunity Memo 생성

#### Source
- PRD §5-2 ("각 기회별 why_now/각도/4축 점수/근거") / User Flow 1~3단계 / hq-main.yaml memo_cards / Data: opportunity_memos·raw_items·sources / Tasks: P2-R1

#### Hard Gates
- HG-002-1: Given company_profile 설정 완료 / When `POST /api/hermes/scan` / Then 네이버 검색 API 실데이터 기반 opportunity_memos 3~5건 생성, 각 건에 topic·why_now·homefeed_angle·search_angle·4축 점수·근거 문장 전부 존재
- HG-002-2: Given 이미 오늘 5건 존재 / When 재스캔 / Then 총 개수 5건 초과 금지 (PRD 운영 원칙 §4-10)
- HG-002-3: Given 생성된 memo / When `GET /api/hermes/opportunity-memos/:id` / Then keyword_clusters가 내장 반환 (resources.yaml:65 계약)
- **[C4-2 신규]** HG-002-4: Given Cron 트리거로 `POST /api/hermes/scan` 호출 / When 요청 헤더에 `CRON_SECRET` 없음 / Then 401 Unauthorized 반환 (무인증 호출 차단)
- **[C4-2 신규]** HG-002-5: Given 동일한 실행 ID로 Cron 재호출 / When 멱등키 적용 / Then opportunity_memo 중복 생성 0건 (트리거 재시도 안전성)

#### Metric Gates
- MG-002-1: Hermes 스캔 완료 < 30초 (TRD §9, 병렬 처리)
- MG-002-2: P2-R1 acceptance G/W/T 4종 + Cron 등록 항목 전부 테스트 통과   hookable: `npm test -- hermes`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | memo 필드 완전성 (PRD §5-2 완료 조건) | 4/5 이상 |
| User Flow Fit | 스캔→카드 표시→상세 동선 | 4/5 이상 |
| UI Consistency | score_chip 컴포넌트 재사용 | 3/5 이상 |
| Maintainability | Hermes 엔진이 AIAdapter 경유 (DEC-002) | 3/5 이상 |

#### Domain Gates
- DG-002-1: 고위험 카테고리(건강·투자·법률·의료·다이어트) 주제는 memo 생성 단계에서 제외 (PRD §4-9)
- DG-002-2: `vercel.json` crons에 매일 06:00 KST 스캔 잡 등록 (06-tasks P2-R1)

#### Evidence Required
- 실제 스캔 실행 로그(또는 모킹 명시) / memo 레코드 샘플 / 테스트 결과 / 남은 리스크

---

### REQ-003: 주제 점수화 — 4축 + 근거

#### Source
- PRD §5-3 ("각 점수 0~100, 이유 명시") / 00 §16 (4축 통일) / components.yaml score_chip / Data: opportunity_memos.homefeed/search/revenue/risk_score + reasons / Tasks: P2-R1

#### Hard Gates
- HG-003-1: Given 생성된 memo / When 점수 확인 / Then homefeed_score·search_score·revenue_score·risk_score 각 0~100 정수 + 축별 근거 문장(reasons) 존재
- HG-003-2: Given 화면 표시(hq-main, content-detail) / When 렌더 / Then 4축만 노출 — 11변수 공식·내부 변수는 어떤 화면에도 노출 금지 (00 §7.5: Phase 4+ 참고용)

#### Metric Gates
- MG-003-1: 점수 필드 스키마 검증 테스트 통과 (0~100 범위 + reasons not null)   hookable: `npm test -- score`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 4축 + 근거 완전성 | 4/5 이상 |
| UI Consistency | score_chip 단일 컴포넌트로 통일 | 3/5 이상 |

#### Domain Gates
- DG-003-1: risk_score는 "낮을수록 좋음" 방향 — UI 색상 매핑이 반전되어 있는지 확인 (04 주석)

#### Evidence Required
- 점수 표시 스크린샷/렌더 설명 / 스키마 테스트 결과

---

### REQ-004: 주제 선택 / 보류 / 폐기 (오너 의사결정)

#### Source
- PRD §3 4단계 / User Flow 4단계 / hq-main.yaml actions / Data: paperclip_decisions (decision: selected/on_hold/rejected, 04:127) / Tasks: P2-R2

#### Hard Gates
- HG-004-1: Given memo 카드 [선택] / When `POST /api/hq/decisions {decision:"selected"}` / Then paperclip_decisions 1건 + content_package 자동 생성(status='assigned')
- HG-004-2: Given [보류] / When `{decision:"on_hold"}` / Then content_package 미생성, memo 상태 on_hold 표시
- HG-004-3: Given [폐기] / When `{decision:"rejected"}` / Then memo 아카이브 처리, HQ 카드 목록에서 제외

#### Metric Gates
- MG-004-1: decisions API 단위테스트 3분기(selected/on_hold/rejected) 전부 통과   hookable: `npm test -- decisions`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 3분기 동작 완전성 | 4/5 이상 |
| User Flow Fit | 원클릭 결정 (30분 원칙) | 4/5 이상 |

#### Domain Gates
- DG-004-1: decision enum은 `selected/on_hold/rejected`만 허용 — 그 외 값 422 (04:127 정본)
- DG-004-2: 하루 1개 콘텐츠 기준 — 같은 날 2번째 selected 시 확인 경고 (PRD §4-11, 차단은 아님)

#### Evidence Required
- 3분기 테스트 결과 / decisions·content_packages 레코드 샘플

---

### REQ-005: 홈판형 제목 생성 (HomeFeed Desk)

#### Source
- PRD §5-4 ("제목 유형 7종 모두 제시") / User Flow 5단계 / content-detail.yaml preview 탭 / Data: title_candidates (04:255) / Tasks: P3-R1

#### Hard Gates
- HG-005-1: Given selected 패키지 / When `POST /api/optimizers/homefeed/titles` / Then 홈판형 제목 10개 + 썸네일 문구 5개 + 첫 화면 구조(drafts.first_screen) 생성, title_candidates에 hook_type과 함께 저장
- HG-005-2: Given 생성된 제목 10개 / When hook_type 분포 확인 / Then types.yaml HookType 7종이 모두 ≥1회 등장 (PRD 완료 조건)

#### Metric Gates
- MG-005-1: 제목 생성 테스트(개수·유형 커버리지) 통과   hookable: `npm test -- titles`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 10+5+첫화면 완전성 | 4/5 이상 |
| Maintainability | AIAdapter 경유 + 프롬프트 템플릿 분리 (TRD §5) | 3/5 이상 |

#### Domain Gates
- DG-005-1: 낚시성 방지 — "홈판 제목은 강하게, 첫 화면에서 약속 회수" 구조 필드가 함께 생성 (PRD §4-6)

#### Evidence Required
- 생성 샘플(제목 10 + hook_type 태깅) / 테스트 결과

---

### REQ-006: 검색형 구조 생성 (Search Desk)

#### Source
- PRD §5-5 ("H2 3~4개, FAQ 3개, 비교표 1개 최소") / User Flow 6단계 / content-detail.yaml preview / Data: drafts.first_screen·faq·comparison_table + keyword_clusters / Tasks: P3-R1

#### Hard Gates
- HG-006-1: Given selected 패키지 / When `POST /api/optimizers/search/structure` / Then 검색형 제목 + 키워드 클러스터 + H2 3~4개 + FAQ ≥3 + 비교표 ≥1 생성, drafts.faq·comparison_table에 저장

#### Metric Gates
- MG-006-1: 구조 검증 테스트(H2 개수, FAQ ≥3, 비교표 ≥1) 통과   hookable: `npm test -- search-structure`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 최소 구성 요건 충족 | 4/5 이상 |
| Maintainability | AIAdapter 경유 | 3/5 이상 |

#### Domain Gates
- DG-006-1: keyword_clusters는 opportunity_memo에 귀속 (04 KeywordCluster.opportunityMemoId, resources.yaml 계약) — Topic 경유 조인 금지

#### Evidence Required
- 생성된 구조 샘플 / 검증 테스트 결과

---

### REQ-007: 쇼핑커넥트 상품·링크 관리

#### Source
- PRD §5-6 ("URL 붙여넣기 수준 입력, 3~5개 상품") / User Flow 7단계 + 예외 흐름 3 / `specs/screens/products.yaml` (tests 4종) / Data: products·shopping_connect_links / Tasks: P2-R3, P2-S1(+V)

#### Hard Gates
- HG-007-1: Given 상품 URL 1개 붙여넣기 / When `POST /api/products/import` / Then 상품명·가격 자동 채움 + price_checked_at=now 저장 (추가 수동 입력 최소화)
- HG-007-2: Given price_checked_at이 7일 초과인 상품 / When `GET /api/products?stale=true` / Then 해당 상품만 "갱신 필요" 목록으로 반환 + HQ 우측 패널 알림 노출
- HG-007-3: Given 가격 갱신 입력 / When `PATCH /api/products/:id` / Then price_checked_at 갱신 + stale 해제

#### Metric Gates
- MG-007-1: products.yaml tests 4종 자동테스트 통과   hookable: `npm test -- products`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | URL 붙여넣기 등록 + stale 관리 | 4/5 이상 |
| User Flow Fit | 예외 흐름 3(가격 갱신) 재현 가능 | 4/5 이상 |

#### Domain Gates
- DG-007-1: stale 판정 기준 = **7일** (price_checked_at/link_checked_at, resources.yaml:177 정본)
- DG-007-2: 자동 스크래핑 주기 실행 금지 — import 시 1회 크롤링만 (Won't: 쇼핑커넥트 자동 스크래핑)

#### Evidence Required
- import 실행 결과(모킹 명시 가능) / stale 필터 테스트 결과

---

### REQ-008: 네이버 블로그 원문 생성

#### Source
- PRD §5-7 ("Markdown + HTML + 복사용 Export 포함") / User Flow 8단계 / content-detail.yaml preview·edit 탭 / Data: drafts.body_markdown (HTML은 Export 경계 생성) / Tasks: P3-R1

#### Hard Gates
- HG-008-1: Given 제목·구조·링크 배치 완료 패키지 / When `POST /api/content-packages/:id/generate` / Then drafts.body_markdown 생성 및 HTML 미리보기 렌더 가능 (저장 금지, Export 경계 변환)
- HG-008-2: Given 편집 탭에서 본문 수정 / When 2초 경과 / Then `PATCH /api/drafts/:id` 자동 저장 (resources.yaml:91)

#### Metric Gates
- **[C4-1 교체]** MG-008-1: Blog Draft 성능 기준 (수치 완화 X, 측정 대상 변경) — ① 생성 시작 피드백 < 1초 ② 단계별 진행 상태 UI 가시화 ③ 완료 알림 도달. 일일 AI 호출량 기준선 지표 포함 (TRD §9 A5 기준)
- MG-008-2: 생성·자동저장 테스트 통과   hookable: `npm test -- drafts`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 3요소(홈피드+검색+쇼핑) 통합 본문 | 4/5 이상 |
| Maintainability | AIAdapter 경유 + 비용 로깅 (cost_logs) | 3/5 이상 |

#### Domain Gates
- DG-008-1: 미사용 상품 후기체 문장 생성 금지 — 프롬프트 규칙 + Compliance 검출 항목 (PRD §4-5)

#### Evidence Required
- 생성 샘플 본문(요약 가능) / 자동저장 테스트 결과 / AI 비용 로그 1건

---

### REQ-009: Compliance Gate (검수)

#### Source
- PRD §5-10 ("High Risk 0건 = 발행 가능") / User Flow 10~11단계 + 예외 흐름 1·3 / content-detail.yaml compliance 탭 + tests("검수 실패 시 Export 차단", :220) / Data: compliance_checks·compliance_issues / Tasks: P3-R2

#### Hard Gates
- HG-009-1: Given 쇼핑커넥트 링크 포함 + 대가성 문구 없음 / When `POST /api/compliance/check` / Then risk_level=high 이슈 생성 + export_allowed=false
- HG-009-2: Given 가격 표기 + 가격 기준일 없음 / When 검수 / Then high 이슈 + export_allowed=false
- HG-009-3: Given high 이슈 존재 / When Export 시도(UI·API 모두) / Then Export 버튼 비활성 + `POST .../export` 403 (서버 강제, DEC-005)
- HG-009-4: Given [수정하고 다시 검수] / When 수정 후 재검수 통과 / Then export_allowed=true 전환 (재순환 흐름)
- HG-009-5: Given price_checked_at 7일 초과 / When 검수 / Then medium 경고 + "변동 가능 문구 추가" 또는 "가격 갱신" 해소 경로 제공 (03 예외 흐름 3)

#### Metric Gates
- MG-009-1: Compliance 검수 < 5초 (TRD §9)
- MG-009-2: 검수 규칙 4종(대가성·가격 기준일·출처·과장 표현) 각 ≥1 테스트   hookable: `npm test -- compliance`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 4종 검수 규칙 완전성 | 4/5 이상 |
| User Flow Fit | 실패→수정→재검수 재순환 | 4/5 이상 |

#### Domain Gates
- DG-009-1: low/medium 이슈는 `POST /api/compliance/issues/:id/dismiss`로 무시 가능, high는 dismiss 불가
- DG-009-2: 검수 통과 상태 전이는 §10 정본 순서 준수: compliance_checked → owner_approval_required → approved
- **[C4-5 신규]** DG-009-3: [무시] 감사 이력 게이트 — low=원클릭+자동기록(dismissed_by/dismissed_at) / medium=사유 필수(dismiss_reason 필드) / high=dismiss 불가(API 거부)로 차등 규칙 적용 (04 B4 compliance_issues 감사 필드와 연동)
- **[C4-5 신규]** DG-009-4: [무시] 기록이 없으면 Compliance Gate의 사후 방어 가능성 0 — 무기록 override 절대 금지, 모든 무시 액션은 이력 저장 필수 (council-report §2-8)

#### Evidence Required
- high 차단 시나리오 테스트 결과 (403 응답 포함) / **[C4-5 추가]** [무시] 이력 기록 테스트 (dismissed_by/at/reason 저장 확인) / 검수 규칙별 테스트 목록 / 남은 리스크

---

### REQ-010: Export Bundle

#### Source
- PRD §5-11 / User Flow 12단계 / content-detail.yaml export_panel / Data: exports (04:270, format/content) / Tasks: P3-R3

#### Hard Gates
- HG-010-1: Given export_allowed=true 패키지 / When `POST /api/content-packages/:id/export` / Then Markdown·HTML·복사용·ZIP 4형식 exports 레코드 생성 (HTML은 body_markdown에서 sanitize 후 생성)
- HG-010-2: Given export_allowed=false / When export 호출 / Then 403 + 생성 0건 (HG-009-3와 쌍)
- HG-010-3: Given Export 완료 / When 상태 확인 / Then 패키지 status='exported' 전이

#### Metric Gates
- MG-010-1: Export 생성 < 3초 (TRD §9)
- MG-010-2: 4형식 + 403 테스트 통과   hookable: `npm test -- export`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 4형식 완전성 | 4/5 이상 |
| User Flow Fit | 원클릭 Export→복사 (30분 원칙) | 4/5 이상 |

#### Domain Gates
- DG-010-1: 자동 발행 절대 금지 — Export는 파일/클립보드 산출까지만, 네이버 발행 API 호출 코드 부재 (DEC-001)

#### Evidence Required
- 4형식 샘플 / 403 테스트 결과 / 발행 API 부재 확인 (grep 결과)

---

### REQ-011: Performance Logger

#### Source
- PRD §5-12 ("숫자 3~4개만 입력") / User Flow 14단계 / `specs/screens/performance.yaml` (tests 4종, clicks required) / Data: performance_logs / Tasks: P4-R2, P4-S2(+V)

#### Hard Gates
- HG-011-1: Given 게시 완료 콘텐츠 / When `POST /api/performance-logs` (필수: post_url·views·clicks, 선택: direct_revenue·hook_type) / Then 저장 + platform 자동 감지 + recorded_at=now
- HG-011-2: Given 필수 필드 누락 / When 저장 시도 / Then 클라이언트 검증 메시지 + 422
- HG-011-3: Given 기록 1건 이상 / When `GET /api/performance-logs?period=week` / Then 평균 views·clicks·revenue + best_hook_type 반환

#### Metric Gates
- MG-011-1: performance.yaml tests 4종 통과   hookable: `npm test -- performance`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 최소 입력(필수 3 + 선택 2) 준수 | 4/5 이상 |
| User Flow Fit | 기록 1건 < 1분 소요 동선 | 4/5 이상 |

#### Domain Gates
- DG-011-1: 입력 필드 총 5개 초과 금지 — 신규 필수 필드 추가는 설계 변경 승인 필요 (30분 원칙)

#### Evidence Required
- 기록/집계 테스트 결과 / 주간 요약 응답 샘플

---

### REQ-012: Company Memory

#### Source
- PRD §5-13 ("다음 의사결정에 반영") / User Flow 15단계 / hq-main.yaml winning_patterns 블록 / Data: company_memory / Tasks: P4-R3

#### Hard Gates
- HG-012-1: Given 성과 기록 누적 / When 메모리 갱신 로직 실행 / Then hook_type별 성과 패턴이 company_memory에 저장
- HG-012-2: Given company_memory에 패턴 존재 / When HQ 로드 / Then Winning Patterns 블록에 표시
- HG-012-3: Given 다음 Hermes 스캔 / When memo 생성 / Then company_memory 컨텍스트가 AI 입력에 포함됨 (프롬프트 로그로 검증)

#### Metric Gates
- MG-012-1: 메모리 갱신·반영 테스트 통과   hookable: `npm test -- memory`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 기록→학습→반영 루프 폐쇄 | 4/5 이상 |

#### Domain Gates
- DG-012-1: 실패 원인도 저장 (잘 된 패턴만이 아니라 — PRD §5-13 "실패 원인 저장")

#### Evidence Required
- memory 레코드 샘플 / 프롬프트 포함 증거(로그) / 테스트 결과

---

### REQ-013: 네이버 검색 API 연동 + 장애 폴백

#### Source
- PRD Must "네이버 검색 API 연동" + 리스크 §6 (API 장애 폴백) / User Flow 1단계 + 예외 흐름 2 / Data: sources·raw_items·error_logs / Tasks: P0-T2, P2-R1

#### Hard Gates
- HG-013-1: Given 네이버 API 키 설정 / When 블로그·쇼핑 검색 호출 / Then raw_items 저장 + 쿼터·응답시간 로깅
- HG-013-2: Given 네이버 API 장애(타임아웃/429) / When 스캔 실행 / Then 폴백 동작 — 이전 스캔 결과 + AI 보완으로 memo 생성 + HQ에 "최근 스캔 결과 기반" 안내 표시 (03 예외 흐름 2)
- HG-013-3: Given API 오류 발생 / When 폴백 전환 / Then error_logs에 원인 기록
- **[C4-2 신규]** HG-013-4: Given Cron 엔드포인트에서 API 호출 / When 요청 인증 / Then 환경변수 `CRON_SECRET` 헤더 검증 필수 (무인증 트리거 방지)

#### Metric Gates
- MG-013-1: API 클라이언트 + 폴백 단위테스트(정상/타임아웃/429) 통과   hookable: `npm test -- naver-api`

#### Rubric Gates
| 항목 | 기준 | 통과 기준 |
|---|---|---|
| Requirements Fit | 실데이터 + 폴백 이중화 | 4/5 이상 |
| Maintainability | API 클라이언트 모듈 분리 (P0-T2) | 3/5 이상 |

#### Domain Gates
- DG-013-1: API 키는 환경변수만 — 코드/저장소 하드코딩 금지   hookable: `grep -rn "NAVER_CLIENT" --include="*.ts" src/ | grep -v "process.env"` (매치 0이어야 pass)

#### Evidence Required
- 폴백 시나리오 테스트 결과 / error_logs 샘플 / 키 하드코딩 grep 결과

---

## Decision Gate Map (ADR 패턴 — 왜 + 강제 수단 쌍)

### DEC-001: 자동 발행 절대 금지 (모든 게시는 수동)
- **왜**: 네이버 블로그 글쓰기 API 2020년 종료 + 자동 발행은 플랫폼 정책 위반 리스크 — 계정 제재 시 사업 자체가 중단된다 (PRD §4-2, 리스크 §6)
- **강제 수단**: 코드베이스에 네이버 발행/포스팅 엔드포인트 호출 부재를 검증 체크리스트 항목으로 + 독립 verifier가 grep 확인   hookable: `grep -rn "blog.naver.com/api\|PostBlog\|publishToNaver" src/` (매치 0)
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-001`
- **Source**: PRD §4-2, 00-source-plan Won't

### DEC-002: 모든 AI 호출은 AIAdapter 인터페이스 경유
- **왜**: AI 모델 미결(Open Question) 상태 — 어댑터 밖에서 SDK를 직접 호출하면 모델 교체 시 전면 수정이 필요해지고 비용 로깅이 누락된다 (TRD §5)
- **강제 수단**: `src/lib/ai/` 외부에서 AI SDK import 금지 — 린트 룰(no-restricted-imports) 또는 grep   hookable: `grep -rln "@anthropic-ai/sdk\|openai" src/ --include="*.ts" | grep -v "src/lib/ai/"` (매치 0)
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-002`
- **Source**: TRD §5 (AIAdapterInterface, 02-trd:395)

### DEC-003: 상태값은 §10 정본만 사용 (임의 상태 문자열 금지)
- **왜**: Round 1에서 상태 3원화(`awaiting_export` 등)로 추적성이 끊겼다 — 임의 상태가 하나라도 생기면 칸반·검수·Export 게이트 전부가 다르게 해석된다
- **강제 수단**: **[C4-4 갱신]** ① `specs/shared/types.yaml` PackageStatus를 TS **Prisma enum**으로 단일 소스화 (4개 테이블 분산 String 금지) ② `StatusTransition` 이력 테이블 신설(package_id, from, to, actor, reason?, created_at) ③ "모든 상태 변경은 단일 전이 서비스 경유(직접 UPDATE 금지)" 원칙 강제 (04-database-design B1과 쌍)   hookable: `npx tsc --noEmit` + `grep -rn "\.update({.*status" src/` (직접 상태변경 마치 0)
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-003`
- **Source**: 00-source-plan §10, types.yaml PackageStatus, council-report §2-1·§3-1

### DEC-004: DB 접근은 Prisma Client 단일 경로 (camelCase 모델 + @map)
- **왜**: 04의 @map 규칙(스키마 snake_case ↔ 코드 camelCase)이 정착돼야 resources.yaml 계약과 코드가 계속 일치한다 — raw SQL이 섞이면 계약 검증이 불가능해진다
- **강제 수단**: `$queryRaw`/`$executeRaw` 사용 금지(예외는 04에 문서화 후)   hookable: `grep -rn "queryRaw\|executeRaw" src/` (매치 0)
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-004`
- **Source**: 04-database-design (28모델 @map 규칙), 07-coding-convention Prisma 절

### DEC-005: Compliance 차단은 서버에서 강제 (UI 차단만으로 불충분)
- **왜**: Export 차단이 버튼 비활성뿐이면 API 직접 호출로 우회된다 — 대가성 문구 없는 글이 나가면 정책·법적 리스크가 실현된다 (PRD §4-3·4)
- **강제 수단**: export API가 compliance_checks.export_allowed를 서버에서 재확인, false면 403 — HG-009-3/HG-010-2 테스트가 이를 상시 검증   hookable: `npm test -- export`
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-005`
- **Source**: PRD §4-3·4, resources.yaml:141 ("export_allowed=true일 때만 생성 가능")

### DEC-006: 입력 최소화 — 화면당 필수 입력 필드 상한 (30분 원칙)
- **왜**: "하루 30분"은 이 제품의 존재 이유 — 필수 입력이 하나 늘 때마다 지속 가능성이 깎인다 (05 §핵심 설계 원칙 1순위)
- **강제 수단**: 검증 체크리스트 항목 — 새 폼 추가/변경 시 필수 필드 수를 화면 yaml의 data_requirements와 대조, 초과 시 설계 변경 승인 요구 (기계 강제 불가 → 최소 강제)
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-006`
- **Source**: 05-design-system §핵심 설계 원칙, performance.yaml(필수 3+선택 2)

### DEC-007: AI 비용 서킷브레이커 (소프트 임계 → 하드 캡)
- **왜**: 무상한 AI 호출은 경제적 DoS 공격 수단이자 재생성 폭주에 무방비 — cost_logs는 기록만 하므로 실시간 차단 메커니즘 필수 (council-report §2-2)
- **강제 수단**: ① 소프트 임계(일일 예산 X% 초과 시 알림, HQ 헤더에 차단 상태 배지) → ② 하드 캡(신규 생성 차단) 2단계 ③ 진행 중 파이프라인은 단계 경계에서 예산 체크 후 soft-stop(중단하되 기존 데이터 유실 금지) — HQ 헤더 알림 UI + "차단됨" 상태 명시
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-007`
- **Source**: council-report §2-2, TRD §5 (AI 어댑터 비용 모니터링)

### DEC-008: AI 출력 JSON 스키마 검증 + 규칙 기반 override 원칙
- **왜**: LLM은 출력 스키마를 확률적으로만 지킴 — 파싱 실패·타입 오염·Compliance Gate 우회를 방지하려면 zod 검증 필수. 규칙 기반 컴플라이언스가 LLM 판정을 override하는 원칙을 명문화하면 Prompt Injection 위협 완화 (council-report §2-12, council §5-1 UX)
- **강제 수단**: ① 모든 AI 출력 JSON에 zod 스키마 검증 단계 적용 (1차: AI 출력 → 이후 상태변경·외부유입 엔드포인트 순) ② `policy_rules` 규칙 기반 판정이 최종 권위 — LLM "안전" 판정도 규칙 high-risk 위반 시 차단 (§9-3)
- **위반 시 포인터**: `docs/planning/loop/08-derived-gates.md#DEC-008`
- **Source**: council-report §2-12, TRD A8, 07-coding-convention F3

---

## Prevention Gates (탐지보다 예방 — 빌드 중 승격분)

| ID | 무엇을 불가능하게 | 어떤 구조로 | 승격 사유 (반복 실패) | hookable |
|---|---|---|---|---|
| (초기 파생 시점 — 비어 있음. 같은 게이트 2회 연속 fail 시 여기로 승격) | | | | |

---

## Gate Self-Validation Log

> 6기준: 모호X · 테스트 가능 · 문서 연결 · 완료 판단 가능 · 추상적 표현X · 구현 기준 사용 가능

- REQ-001~013: **pass** — 전 REQ가 G/W/T Hard Gate ≥1 + Evidence Required 보유, Source 체인(PRD→Flow→Screen→Data→Task) 연결 확인 (Round 2 traceability 표 기준, 단절 0건)
- DEC-001~006: pass — 각각 왜/강제 수단/포인터 3요소 완비. DEC-006은 기계 강제 불가 → 체크리스트 최소 강제로 명시
- **조정 기록**: MG-*-hookable의 테스트 명령은 러너 미확정으로 `npm test -- <필터>` 형태 잠정 표기 — P0-T1에서 러너 확정 시 실제 명령으로 치환 (upstream gap 아님, 셋업 순서 문제)
- upstream gap REQ: **없음**
