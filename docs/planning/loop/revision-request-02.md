# Revision Request 02 — Council 리뷰 합의사항 반영 (2026-07-02)

> 근거: `docs/planning/council-report.md` (3인 교차검증 합의 19건 + 개선 15건)
> 원칙: 전체 재생성 금지 — 지목 섹션만 패치. **미합의 쟁점 8건(council-report §4)은 반영 금지** — 해당 부분은 "⚖️ 결정 대기 (council-report §4-N)" 마커만 남긴다.
> 사용자 승인: 2026-07-02 (합의사항 기획 반영 선택)

---

## A. `02-trd.md` 패치 (+ §데이터 접근 경계 신설)

- **A1 [P0] Cron 보안·멱등성**: 보안 절에 추가 — ① 모든 cron 트리거 엔드포인트(`POST /api/hermes/scan` 등)는 `CRON_SECRET` 헤더 검증 필수 ② 멱등키는 **트리거 실행 ID 단위** (일자별 unique 금지 — 03 예외 흐름 2의 [새로 스캔] 수동 재스캔과 충돌하므로).
- **A2 [P0] AI 비용 서킷브레이커**: §5(AI 어댑터) 또는 비용 절에 추가 — 소프트 임계(알림) → 하드 캡(신규 생성 차단) 2단계. 진행 중 파이프라인은 **단계 경계에서 예산 체크 후 soft-stop**(중단=데이터 유실 금지). 차단 상태의 HQ 헤더 알림 UI 요구 명시.
- **A3 [P0] 비동기 실행 모델 결정 항목 신설**: 동기 `/generate`는 Vercel serverless 타임아웃과 충돌해 실행 불가 가능성 명시. 후보 2안(잡 큐: Inngest/QStash/Supabase Queues vs 경량: maxDuration 연장 + 클라이언트 단계별 순차 호출)을 Open Question으로 기재하고 **"결정 전 P3-R1 착수 금지"** 게이트 문구. ⚖️ 수단 선택은 결정 대기 (council-report §4-2).
- **A4 [P0] 인증 단일화**: "API 인증: Bearer Token" 문구 삭제 → **NextAuth 세션 쿠키 단일 방식**으로 확정 (env 단일 자격증명 Credentials provider, rate limit 적용, 공격적 lockout 금지 — 유일 사용자 자기잠금 방지). 상태 변경 API CSRF 보호 + "세션 만료 중 자동 저장 실패 시 로컬 보존→재로그인 후 재전송" 요구 명시.
- **A5 [P0] 성능 기준 재정의**: §9 "Blog Draft 생성 < 10초" → **"생성 시작 피드백 < 1초 + 단계별 진행 상태 가시화 + 완료 알림 도달"**로 교체 (수치 완화가 아닌 측정 대상 변경). 재생성 폭주 감지용 일일 AI 호출량 기준선 항목 추가.
- **A6 [P0] 콘텐츠 정본 = Markdown**: 콘텐츠 저장 정본은 body_markdown 단일. HTML은 **Export 경계에서 생성** (bodyHtml 상시 저장 폐지). sanitization 이원화 — 미리보기: DOMPurify 엄격 / Export: 네이버 에디터 호환 allowlist.
- **A7 [신설] "데이터 접근 경계" 섹션**: RLS 미사용 + 전 접근 서버(API Routes) 경유 + Supabase anon key 클라이언트 미사용 + Storage 버킷 비공개 + pgBouncer/DIRECT_URL 구분을 명문화 (선택 자체보다 명문화 부재가 결함).
- **A8 AI 출력 검증**: §5·§6에 — 모든 AI 출력 JSON은 zod 스키마 검증 필수(1차 적용: AI 출력 → 이후 상태변경·외부유입 엔드포인트 순 단계 적용). **규칙 기반 컴플라이언스 판정이 LLM 판정을 override**하는 원칙 명문화.
- **A9 Company Memory 최소 실효선**: 구조화 필드 + enum 태그(자유 텍스트 프롬프트 주입 면적 축소), 표본 N<5이면 추천 억제("배우는 중" 정직 표시), 패턴이 어느 생성에 쓰였는지 가시성.

## B. `04-database-design.md` 패치

- **B1 [P0] 상태 실행 계약**: ① `PackageStatus` 등 상태 컬럼을 String → **Prisma enum**으로 (4개 테이블 분산 String 금지) ② `StatusTransition` 이력 테이블 신설(package_id, from, to, actor, reason?, created_at) ③ "모든 상태 변경은 단일 전이 서비스 경유(직접 UPDATE 금지)" 주석. ⚠️ **최종 상태 목록 확정은 승인 워크플로 쟁점(§4-1) 결정 후** — 현 types.yaml 29상태를 enum으로 옮기되 "운영 상태 축소(칸반 매핑 기준) + 승인 상태 방향은 결정 대기" 주석 필수.
- **B2 [P0] Draft.bodyHtml 폐지**: A6 반영 — bodyHtml 컬럼 제거(또는 "Export 경계 생성, 저장 안 함" 주석으로 전환), `faq`는 **JSON 구조 확정**: `[{question, answer}]` (타입 미확정 시 이스케이프 규칙 설계 불가).
- **B3 Draft.originalBody 스냅샷 1컬럼 추가**: [되돌림] 버튼 지원용 (풀 리비전 테이블 금지 — 1인 도구 과잉). 보존 정책 표에 반영.
- **B4 compliance_issues 감사 필드**: dismissed_by, dismissed_at, dismiss_reason 추가. 차등 규칙 주석: low=원클릭+자동기록 / medium=사유 필수 / high=dismiss 불가(기존 유지).
- **B5 error_logs 마스킹**: context에 request_body 원문 저장 금지 — 민감 필드 거부목록(password, token, secret, authorization) 마스킹 후 저장 주석.
- **B6 company_memory 구조화**: A9 반영 — 자유 텍스트 단일 필드면 구조화 필드+enum 태그로 분해, sample_count 필드(N<5 억제용).
- **B7 보존 정책 모순 정정**: raw_items 90일 vs 무제한 등 보존 정책 표 내 모순 확인·통일 (council 지적 "90일 vs 무제한").

## C. `06-tasks.md` + `docs/planning/loop/08-derived-gates.md` 패치

- **C1 [P0] P2-R1 acceptance 추가**: CRON_SECRET 검증 G/W/T + 트리거 실행 ID 멱등성 G/W/T (동일 실행 ID 재호출 시 memo 중복 생성 0건).
- **C2 [P0] 보안 체크리스트 편입**: P0 수준 체크리스트(CRON_SECRET / sanitization 이원화 / error_logs 마스킹 / `npm audit` / env 시크릿 하드코딩 금지)를 해당 태스크 acceptance 또는 gates에 편입 (풀 위협모델은 과잉 — 전원 합의).
- **C3 [P0] P3-R1 선행 조건**: "비동기 실행 모델 결정(A3) 전 착수 금지" 명시.
- **C4 gates 갱신**: ① MG-008-1 "Draft < 10초" → A5 기준으로 교체 ② REQ-002/013에 CRON_SECRET·멱등성 HG 추가 ③ **DEC-007 신설**: AI 비용 서킷브레이커(왜: 무상한 AI 호출은 경제적 DoS·재생성 폭주에 무방비 / 강제: 어댑터 레이어 예산 체크 + cost_logs 일일 집계 테스트 / 포인터: #DEC-007) ④ **DEC-008 신설**: AI 출력 zod 검증 + 규칙 기반 override(A8) ⑤ DEC-003 강제 수단에 "Prisma enum + 단일 전이 서비스 + StatusTransition 이력"(B1) 반영 ⑥ HG-009 계열에 [무시] 감사 이력 게이트 추가(B4).
- **C5 성과 리마인드**: cron 추가 금지 — "접속 시 미기록 배지" 방식 명시 (P4-R2/S2 acceptance 문구).

## D. `05-design-system.md` + `06-screens.md` 패치

- **D1 토스트 심각도 분리**: "4초 자동 소멸" 단일 규칙 → 정보성=자동 소멸 / 에러·컴플라이언스=수동 해제 + 재확인 경로.
- **D2 헤더 상태 색상 문법**: 정상 상태(Focus)=빨강 지정 수정 (경보 피로 방지 — 정상은 중립/긍정 색). 헤더 상태 개수 4 vs 5 문서 불일치 정정.
- **D3 사이드바 Phase 1 숨김**: 미구현 하위 메뉴(~20개)는 Phase 1에서 렌더하지 않음 명시 (스텁 라우트 생성 금지).
- **D4 터치 타깃 반응형 분기**: 모바일 한정 44px, 데스크톱 28px 유지(WCAG 2.5.8 AA). [폐기] 등 파괴적 액션에만 확인 단계 추가.
- **D5 content-detail [저장][취소] 제거**: 자동 저장 유지 시 중복 버튼 제거, [되돌림]은 originalBody 스냅샷 기반(B3) 명시. 탭 명칭 충돌·Phase 2 편집 탭 유실 표기 정정 (council 지적).
- **D6 HQ 미기록 배지**: C5와 쌍 — 게시 후 성과 미기록 콘텐츠 수 배지 표시.

## E. `03-user-flow.md` + `specs/` 패치

- **E1 [P0] 빈 프로필 가드**: company_profile 미설정 시 생성 파이프라인 fail-closed 차단 + 설정 유도 — 03에 "예외 흐름 5: 첫 실행/프로필 미설정" 신설, settings.yaml·hq-main.yaml에 해당 상태 명시.
- **E2 products/import 방어+폴백**: products.yaml(또는 03 7단계)에 — SSRF 방어(도메인 allowlist·내부 IP 차단·리다이렉트 제한) + 실패 시 "지원하지 않는 주소예요. 직접 입력하시겠어요?" 수동 입력 폼 폴백. ⚖️ 기능 존속 여부는 결정 대기 (council-report §4-6).
- **E3 on_hold 재검토 경로**: 03 + hq-main.yaml — Hermes Desk(memo 목록) 필터 탭으로 on_hold 재노출. 모바일에서 우측 패널(승인 대기열 등) 접근 동선 정의. "키보드 내비게이션·reduced-motion은 MVP a11y 제외" 명시적 문서화.
- **E4 types.yaml 상태 주석**: B1과 쌍 — "구현 enum은 이 문서가 정본, 운영 상태 축소·승인 방향은 결정 대기(§4-1)" 주석 추가.
- **E5 resources.yaml drafts**: body_html 필드 처리(A6/B2와 정합) — Export 경계 생성으로 주석 변경, faq JSON 구조 명시.
- **E6 명칭 통일**: compliance_rules vs policy_rules 혼용 → `policy_rules`(04 테이블명)로 통일 (전 문서 grep).

## F. `07-coding-convention.md` 패치

- **F1**: sanitization 이원화 규칙(A6) — DOMPurify 미리보기/Export allowlist 유틸 규칙.
- **F2**: 로깅 마스킹 규칙(B5) — 민감 필드 거부목록 상수 + 로거 적용 예시.
- **F3**: zod 검증 규칙(A8) — AI 출력 파싱 표준 패턴 예시.
- **F4**: 상태 전이 서비스 규칙(B1) — `transitionStatus(packageId, to, actor)` 단일 진입점, 직접 `db.contentPackage.update({status})` 금지.
- **F5**: CSRF·rate limit 규칙(A4) 1절.

---

## ⚖️ 반영 금지 (미합의 쟁점 — 사용자 결정 대기, council-report §4)
1. 승인 워크플로 방향 (상태 추가 vs 화면 삭제)
2. 비동기 실행 수단 (잡 큐 vs 경량 중간해)
3. 멀티테넌시 owner_id 컬럼
4. 4축 점수 이중 저장 의미론 (스냅샷 vs 라이브)
5. 칸반 예외 상태 노출 방식
6. P2-S1 URL 붙여넣기 존속 여부 (E2는 방어 요건만)
7. raw_items 저장 범위·법률 검토 스코프
8. Prompt Injection 투자 수위 (A8 최소선 초과분)

처리 상태: **완료** (2026-07-02 — A~F 전 섹션 반영 + 감독관 후속 3건: 02-trd·00·gates policy_rules 통일 / resources.yaml original_body 표기 / 06-tasks P0-T1 스키마 참조를 04 정본(27모델)으로 갱신. 검증: Prisma 문법 grep 0건, 결정 대기 마커 5개 파일 확인)
