# 00-loop.md — Planning/Build Loop Charter

> 산출: `docs/planning/loop/00-loop.md` (LOOP 9, 2026-07-02)
> 상위 루프 원칙을 이 프로젝트에 인스턴스화한 차터. `08-derived-gates.md`와 **함께** 완료 기준이 된다.

## Project
- 이름: Paperclip Company OS v0.7 — 1인 AI 미디어커머스 운영 OS
- Planning line: socrates
- 승인 상태(최종): Ready (final-planning-approval.md 참조)

## 1. 완료의 정의 (Definition of Done)
- 일반 원칙(이 차터) **+** `08-derived-gates.md`의 REQ별 게이트를 함께 충족해야 "완료".
- **`08-derived-gates.md`의 Hard / Metric / Domain 게이트를 증거와 함께 통과하기 전까지
  어떤 Task/Phase도 "구현 완료"를 선언할 수 없다.**
- 게이트 대응표: Task ↔ REQ 연결은 각 REQ의 Source 절(Tasks 항목)을 따른다.

## 2. 상위 루프 원칙
- 표현(구현)은 자유, 완료 판정은 게이트로 엄격.
- 증거 없는 완료 주장 금지("아마", "should work").
- 3회 실패 시 systematic-debugging 전환.
- task는 한 번에 구현 가능한 단위로 — **P3-R1은 과대(7 엔드포인트 + AI 생성 7종) → 빌더가 내부에서 3분할 권장** (optimizers / draft 생성 / 자동저장).

## 3. 우선 구현 순서 (from final-planning-approval)
1. **P0**: 프로젝트 생성 + Prisma 스키마 마이그레이션(P0-T1, 04 Round 2 정렬본 기준) + 네이버 검색 API 클라이언트·폴백(P0-T2) → REQ-013
2. **P1~P2**: 인증·공통 레이어 → Hermes 스캔·memo·4축 점수(P2-R1, Vercel Cron 포함) + 의사결정(P2-R2) + 상품/링크(P2-R3) → REQ-002·003·004·007
3. **P3**: 콘텐츠 생성 파이프라인(P3-R1 3분할) → Compliance(P3-R2) → Export(P3-R3) → REQ-005·006·008·009·010
4. **P4**: HQ 메인(P4-R1/S1) → Performance Logger(P4-R2/S2) → Company Memory(P4-R3) → REQ-001·011·012

## 4. 개발자가 가장 조심해야 할 지점
- **Compliance 차단은 서버 강제** (DEC-005) — UI 비활성화만으로 끝내면 게이트 fail (HG-009-3, HG-010-2)
- **자동 발행 코드 절대 금지** (DEC-001) — Export까지만, 게시는 사용자 수동
- **상태값은 types.yaml PackageStatus 정본만** (DEC-003) — 임의 상태 문자열이 Round 1 최다 결함 원인이었다
- **AI 호출은 AIAdapter 경유** (DEC-002) — 모델 미결 상태, 어댑터 밖 SDK 직접 호출 금지
- **stale = 7일**, decision = `selected/on_hold/rejected`, 점수 = 4축(`*_score`)만 노출 — 표기 이탈은 Round 1에서 전부 정리된 항목이므로 재발 시 즉시 rework
- 테스트 러너 미확정 — P0-T1에서 확정(권고: Vitest + Playwright) 후 게이트 hookable 명령 치환

## 5. 게이트 소비 규약 (다운스트림)
- `auto-orchestrate` / `verification-before-completion`은 Phase/Task 완료 전
  `08-derived-gates.md`에서 해당 REQ의 게이트를 찾아 증거와 대조한다.
- `cmux-harness`는 build 시작 전 이 차터를 read하고 완료의 정의를 dispatch 규약으로 삼으며,
  검증 체크리스트에 연결 REQ/DEC 게이트를 포함한다.
- `hookable:` 마킹 게이트는 대상 프로젝트 pre-commit 훅으로도 설치(게이트 훅화 — 이중 그물).
- 미달이면 완료 차단 → 재작업. 같은 게이트 2회 연속 실패 시 구조적 차단(Prevention) 승격 검토.

## 6. 잔존 리스크 (개발 중 모니터링)
- 08-business-model 수익 계산 자기모순(₩6,000/글 vs 월 목표 ₩500,000) — 설계 비차단, 사업 가정 검증 필요 (문서 자체 인지)
- 로딩/빈/에러 상태 화면 규칙 부분 정의 — 구현 시 05-design-system 토큰 기반 기본값 적용, S태스크 리뷰에서 확인
- 네이버 검색 API 쿼터/정확도 미검증 (PRD Open Question) — P0-T2에서 실측
- AI 모델 미결 — DEC-002 어댑터 격리로 리스크 흡수
