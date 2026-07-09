# Studio v0.1 리뷰 (planning-loop-supervisor, 2026-07-04)

> 판정: **v2 비전 문서로 채택** (사용자 결정 2026-07-04). 현행 빌드 정본은 Company OS v0.7.
> v2 재기획 착수 시 아래 결함부터 해소할 것.

## A. v0.7 승인 패키지와의 충돌 8건

| # | 항목 | v0.7 (승인) | Studio v0.1 | 처리 |
|---|---|---|---|---|
| C1 | 멀티유저 SaaS | Won't 명시 제외 | §17 워크스페이스/5권한 처음부터 | 전방 호환으로 부분 수용: workspaces 테이블 + company_profile 연결만 v0.7에 선삽입 (council §4-3 종결) |
| C2 | 채널 범위 | 네이버 블로그 1채널, SNS Phase 2 | MVP부터 4채널 에이전트 | v2로 이연 |
| C3 | 스택 | Supabase+Vercel 올인 (TRD 확정) | BullMQ+Redis, NestJS/Drizzle 옵션 | v2 결정 사항 — v0.7 불변 |
| C4 | AI 모델 | 미결+어댑터 격리 (council) | OpenAI Responses API 사실상 확정 | v0.7 어댑터 원칙 유지. v2에서 OpenAIAdapter 우선 구현 후보로 기록 |
| C5 | "하루 30분" 원칙 | 05 디자인 1원칙 | 삭제 (일 15콘텐츠 승인 시나리오) | v2 재기획 시 시간 예산 재정의 필수 (B2 참조) |
| C6 | 어휘/상태머신 | opportunity_memos/content_packages/28상태 | briefs/content_jobs/23상태 | [vocabulary-map.md](vocabulary-map.md)로 매핑 |
| C7 | 제휴 채널 | 네이버 쇼핑커넥트 | 쿠팡 파트너스 중심 | v2 확장. 쿠팡 파트너스 API는 실적 요건 충족 후 승인제 유의 |
| C8 | stale/신선도 | 7일 (게이트 DG-007-1) | 3일 (§8.2 freshness 예시) | v0.7 7일 유지. v2에서 소스 타입별 차등 신선도로 일반화 권장 |

## B. Studio 문서 내부 결함 7건 (v2 착수 전 해소 필수)

| # | 심각도 | 내용 |
|---|---|---|
| B1 | **High** | **BullMQ+Redis는 Vercel에서 실행 불가** — 워커는 상시 프로세스 필요. §12가 "Vercel + Railway/Fly"로 뭉뚱그려 배포 모델 미결. 13개 큐 설계 전체가 이 결정에 종속 → v2 TRD 1번 결정 항목 |
| B2 | **High** | **승인 병목** — §5 시나리오 일 15건 승인. 시간 예산 부재(30분 원칙 삭제). 일일 총량 상한 + 배치 승인 UX 필요. 승인이 병목이 되면 Compliance Gate 실효성 붕괴 |
| B3 | **High** | **수익 모델·KPI·중단 기준 장(章) 부재** — §2는 전부 기능 목표. v0.7의 ₩6,000/월 문제(08-business-model)에 멀티채널이 답인지 명시 없음. 일 15콘텐츠 = AI 비용 v0.7 대비 10배+인데 비용 서킷브레이커(v0.7 A2)가 cost_logs 기록으로 후퇴 |
| B4 | Medium | 점수 모델 3중 불일치 — §14 표에 competition_score 있으나 산식에 없음. §8.2 예시 score 키 세트가 §14 모델과 다름. 산식은 compliance_risk 감산으로 음수 가능 |
| B5 | Medium | 상태 머신 23개 나열만 — 전이 규칙/주체 미정 (v0.7 B1 단일 전이 서비스 교훈 미반영). MVP에 발행 기능이 없는데 scheduled/published 상태와 §16.4 칸반 컬럼에 포함 |
| B6 | Medium | AI 출력 zod 검증(v0.7 A8)·프롬프트 인젝션 대응(A9) 부재 — RSS/URL 수집물을 프롬프트에 넣는 구조라 인젝션 면적이 v0.7보다 넓음 |
| B7 | Low | Manselyeok Engine이 §3 핵심 정체성에 있으나 구현은 Phase 5 — 로드맵 절로 이동 권장. TRD급 결정 다수가 "또는"으로 미결(Backend/ORM/Auth/Vector) |

## C. 외부 사실 확인

- ✅ 지식 기반 일치: 네이버 블로그 글쓰기 API 종료(2020-05), 검색·쇼핑 API 일 25,000회, BullMQ v5.16+ Job Schedulers, Meta IG/Threads 발행 API 존재
- ⚠️ 보완: X API 쓰기 접근은 유료 티어 비용이 상당(월 수백 달러대) — "선택적 제외"가 아닌 장기 보류로 간주 권장. Instagram 발행은 비즈니스 계정+앱 심사 요건
- ❓ 미검증(오프라인): 공정위 2026 AI 가상인물 표시 행정예고 인용 — v2 착수 시 원문 확인

## D. v0.7에 반영된 전방 호환 3종 (2026-07-04 패치)

1. `workspaces` 테이블 + `company_profile.workspace_id` (04 §1, default 워크스페이스 시드) — council §4-3 종결
2. Export 로직 `PublisherAdapter` 인터페이스 격리 (02-trd §6, 06-tasks P3-R3-T1)
3. 어휘 매핑 문서 ([vocabulary-map.md](vocabulary-map.md))
