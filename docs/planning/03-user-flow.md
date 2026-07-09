# 03-user-flow.md: 사용자 흐름 상세

> Paperclip Company OS v0.7
> 기준일: 2026-07-02

---

## 1. 하루 운영 흐름 (15단계)

### 1단계: 로컬 스케줄러 (매일 6시)

```
로컬 PC의 Windows 작업 스케줄러/cron이 `npm run scan:hermes` 실행
├─ 네이버 블로그 검색 API: 최근 인기 글 수집 (primary_categories 기반)
├─ 네이버 쇼핑 검색 API: 트렌드 상품 수집
└─ AI로 3~5개 기회를 Opportunity Memo로 변환
  └─ 각 기회: why_now / homefeed_angle / search_angle / 4축 점수 / 근거 문장
  └─ risk_score + blocked_categories 확인 (고위험 카테고리 자동 제외)
  └─ opportunity_memos 테이블에 저장, status = 'opportunity_found'
```

**소요 시간**: < 30초 (병렬 처리)

### 2단계: 사용자 HQ 접속 (아침 10시경)

```
Paperclip HQ 메인 페이지 로딩
├─ 헤더: 오늘 날짜, 상태 (Good / Warning / Revenue / Focus), 버튼 3개
├─ 좌측 사이드바: 부서 7개 (HQ / Hermes / Content / Revenue / Compliance / Memory / Reports)
├─ 중앙 4블록:
│  ├─ 오늘의 경영 브리핑 카드
│  ├─ Hermes Opportunity Memos (카드 리스트, 3~5개)
│  ├─ Content Production Pipeline (칸반)
│  └─ Winning Patterns
└─ 우측 패널 4개 (Owner Queue / Alerts / Revenue / Refresh Needed)
```

**데이터 로드**: HQ 메인 API 호출
```
GET /api/hq/today
├─ company_profile
├─ today_memos (최근 3~5개 opportunity_memos)
├─ pending_decisions (검수 대기 중인 글)
├─ revenue_snapshot (이번 달 예상, 직접/간접 실적)
└─ compliance_alerts (고위험 이슈)
```

### 3단계: Opportunity Memo 검토

```
사용자가 3~5개 카드 검토
각 카드 정보:
├─ 주제명
├─ 4축 점수 (홈피드 / 검색 / 수익 / 리스크)
│  └─ 각 점수 옆에 근거 문장 (예: "자취/장마/생활템 관심사 적합도 높음")
├─ 추천 채널 (Phase 1은 블로그만, Phase 2+ SNS)
└─ 버튼: [선택] [보류] [폐기] [상세보기]
```

**사용자 선택**: [선택] 클릭

### 4단계: 주제 최종 선택 (Paperclip Decision)

```
POST /api/hq/decisions
├─ opportunity_memo_id: "opp_20260702_001"
├─ decision: "selected"
└─ reason: "자취/장마 관심사 적합도 높음 + 쇼핑커넥트 상품 자연스러움"

응답:
├─ content_packages 생성 (새 record)
├─ status = 'assigned'
├─ paperclip_decisions 기록
└─ 모든 Desk에 task 배정
  ├─ HomeFeed Desk → homefeed_score 계산
  ├─ Search Desk → search_title / keyword_cluster 생성
  ├─ ShoppingConnect Desk → 상품 링크 배치
  ├─ Blog Desk → 블로그 본문 생성
  ├─ SNS Desk → 클립/SNS 변환 (Phase 2)
  └─ Compliance Desk → 검수 준비
```

**소요 시간**: 1초 (사용자 클릭 + API 호출)

### 5단계: HomeFeed Desk 처리

```
AI 프롬프트로 처리:
├─ 홈판형 제목 10개 생성 (7가지 유형별 후킹)
│  예: 문제공감형 / 실수지적형 / 비교선택형 / 시즌긴급형 / 
│      체크리스트형 / 반전형 / 구역분리형
├─ 썸네일 문구 5개
├─ 첫 화면(5초) 구조 설계
├─ homefeed_score 계산 (0~100)
│  └─ 근거 문장: "자취/원룸 관심사 명확 +25, 후킹 강도 높음 +30, ..."
└─ drafts 테이블에 저장, 각 draft.status = 'homefeed_packaged'

소요 시간: < 3초 (AI 호출)
```

### 6단계: Search Desk 처리

```
AI 프롬프트로 처리:
├─ 검색형 제목 1개 (keyword 포함)
├─ keyword_cluster (관련 검색어 5~10개)
├─ H2/H3 구조 (3~4개 섹션)
├─ FAQ (3개 이상)
├─ 비교표 (제습제 vs 제습기 vs 탈취제 등)
├─ search_score 계산 (0~100)
│  └─ 근거 문장: "검색 수요 높음 +40, 키워드 구조 적합 +30, ..."
└─ drafts 테이블 업데이트, status = 'search_structured'

소요 시간: < 3초 (AI 호출)
```

### 7단계: ShoppingConnect Desk 처리

```
사용자 입력 필요 또는 자동:
사용자 입력 흐름 (URL 붙여넣기 수준):
├─ [상품 등록] 클릭
├─ 우측 패널: "상품명, URL, 가격, 가격 확인일" 4개 필드
│  예: "미니 제습기 / naver.com/shopping/xxx / 45,000 / 2026-07-02"
├─ [추가] → products 테이블 + shopping_connect_links 생성
└─ 3~5개 상품 등록 (평균 2~3분)

자동 처리:
├─ Hermes가 이미 수집한 상품 후보 제시 (선택만 하면 됨)
├─ 각 상품별 revenue_score 계산
│  └─ 근거: "제습기 검색량 높음 +35, 클릭 의도 명확 +25, 수수료 2% +20, ..."
└─ link_placement_strategy 설계
  ├─ 상단: 대가성 문구
  ├─ 초반: 문제 공감 (링크 0개)
  ├─ 중반: 비교표 안에 상품별 링크
  ├─ 개별: 상품별 추천 상황 설명 후 CTA
  └─ 하단: 최종 정리 + 가격 기준일 + 링크 확인일

drafts 테이블 업데이트, status = 'revenue_links_attached'

소요 시간: 2~3분 (사용자 입력) + < 2초 (AI 처리)
```

### 8단계: Blog Desk 처리

```
AI 프롬프트로 처리:
입력: homefeed 설계 + search 구조 + shopping 상품/링크 + policy_rules
├─ 블로그 원문 생성 (Markdown)
│  ├─ 대가성 문구 (상단)
│  ├─ 공감 / 문제 제기
│  ├─ 해결 리스트 (비교표 포함)
│  ├─ 각 상품별 설명 (링크 포함)
│  ├─ FAQ
│  ├─ 가격 기준일 표기
│  └─ CTA ("더 자세한 링크는 본문 참고")
├─ 내부 검증
│  ├─ 쇼핑커넥트 링크 있으면 대가성 문구 O?
│  ├─ 가격 있으면 기준일 O?
│  └─ 직접 사용 후기가 아닌가?
├─ body_markdown 저장
├─ HTML 미리보기는 body_markdown에서 즉시 렌더링 (저장하지 않음)
├─ HTML 파일은 Export 경계에서만 생성
└─ drafts.status = 'blog_draft_generated'

소요 시간: < 5초 (AI 호출)
```

### 9단계: SNS Desk 처리 (Phase 2)

```
AI로 채널별 변환:
├─ Instagram 캐러셀 (6장 슬라이드)
│  ├─ 첫 장: 강한 후킹
│  ├─ 정보 장들: 짧고 시각적
│  └─ 마지막: CTA ("블로그 링크 확인")
├─ Threads 글 (2~3개 연결 글)
│  ├─ 첫 글: 공감 관찰
│  └─ 마지막 글: 질문형 끝
├─ X 문장 (2~3개)
│  ├─ 첫 문장: 관점 명확
│  ├─ 나머지: 핵심 정보만
│  └─ 링크는 마지막에
└─ sns_variants 테이블에 저장, status = 'sns_repurposed'

소요 시간: < 3초 (AI 호출)
```

### 10단계: Compliance Desk 처리

```
규칙 기반 + LLM 검수:

규칙 기반 검사:
├─ 쇼핑커넥트 링크 있음?
│  ├─ Y → 대가성 문구 있음? / 위치 맞음? / 활동 제한 채널?
│  └─ N → OK
├─ 가격 있음?
│  ├─ Y → 가격 기준일 있음? / 변동 가능 문구?
│  └─ N → OK
├─ 금지 단어 검사 (100% / 무조건 / 완벽 / 최저가 / 1위 등)
├─ 미사용 후기체 검사
├─ 의료/투자/법률 조언 검사
└─ blocked_categories 자동 필터

LLM 검수:
├─ 낚시성 제목인가? (실제 내용과 다른가?)
├─ 본문 첫 화면에서 약속을 회수했는가?
├─ 신뢰도: 근거 충분한가?
├─ 출처 명확한가?
└─ 컴플라이언스_risk_score 계산

결과:
├─ high risk (0개 이상): export_allowed = false, 사용자 알림
├─ medium risk: export_allowed = true이지만 사용자 수동 확인 필수
└─ low risk: export_allowed = true, 바로 Export 가능

compliance_checks 테이블 저장, status = 'compliance_checked'

소요 시간: < 5초 (규칙 + LLM)
```

### 11단계: Export 준비 완료 (또는 수정 필요)

**경우 A: 통과 (High Risk 0개) → 승인 대기**
```
사용자 화면:
├─ "모든 검수 통과! 승인 대기" (status = owner_approval_required)
├─ compliance_score 표시
├─ 우측 패널 승인 대기열에 카드 표시: [승인] [반려]
├─ [승인] 클릭 → status = approved (StatusTransition actor='owner' 기록 — 승인 감사 원장)
│   └─ "[Export] 버튼 활성화" → 사용자 [Export] 클릭 → 12단계
└─ [반려] 클릭 → 반려 사유 입력(선택) → Draft 편집으로 복귀 → 수정 후 재검수 (10단계)

※ 승인은 클릭 1회 — 표시광고법 리스크 제품에서 승인 기록이 법적 방어 자료가 되므로
   검수 통과 ≠ 자동 Export. 오너의 명시적 승인만 Export를 연다. (council-report §4-1 확정)
```

**경우 B: Medium Risk (사용자 확인 필요)**
```
사용자 화면:
├─ "경고: 가격 기준일이 오래됨 (6월 28일)"
├─ [자동 수정 적용] 버튼
├─ 수정 내용 미리보기
└─ [확인했음] → Export 진행

또는 [수정] → Draft 수정 후 재검수
```

**경우 C: High Risk (Export 불가)**
```
사용자 화면:
├─ "검수 실패: 대가성 문구 필수"
├─ 문제 항목 강조표시
├─ 추천 수정문구 제시
├─ Draft 편집 화면 열기
└─ [재검수] 버튼

사용자 수정 → Compliance Desk 재검수 → 11단계 다시
```

### 12단계: Export Bundle 생성

```
POST /api/content-packages/:id/export
├─ Markdown 형식
│  ├─ 헤더: 제목, 대가성 문구, 가격 기준일
│  ├─ 본문: 마크다운 (GitHub markdown 호환)
│  └─ 다운로드: 파일명_yyyy-mm-dd.md
├─ HTML 형식
│  ├─ 스타일 포함 (기본 스타일만)
│  ├─ 이미지 임베드 불가 (링크만)
│  └─ 다운로드: 파일명_yyyy-mm-dd.html
├─ 복사용 (Plain Text)
│  ├─ 복사 버튼 클릭 → 클립보드에 자동 복사
│  ├─ 포맷: 블로그 게시판에 그대로 붙여넣기 가능
│  └─ 이미지는 "[이미지: 제목]" 표기
└─ ZIP Bundle
  ├─ Markdown / HTML / Plain Text 포함
  ├─ export_manifest.json 포함
  └─ SNS 복사용 텍스트는 Phase 2에서 SNSVariant 기반으로 추가

exports 테이블 저장 (file_urls 기록)

소요 시간: < 3초
```

### 13단계: 사용자 수동 게시

```
사용자가 각 플랫폼에 직접 게시:

네이버 블로그:
├─ blog.naver.com 접속
├─ Export의 Markdown or HTML 복사해서 붙여넣기
├─ 썸네일 이미지 업로드
├─ [저장] 클릭
└─ 게시 URL 복사

네이버 클립 (Phase 2):
├─ clips.naver.com 접속
├─ SNS 변환본의 클립 대본 참고
├─ 직접 동영상 촬영 or 이미지 활용
├─ 정보태그/쇼핑태그 추가
├─ [저장] 클릭
└─ 게시 URL 복사

Instagram / Threads / X (Phase 2):
├─ 각 플랫폼 접속
├─ SNS 복사용 텍스트 붙여넣기
├─ 이미지/비디오 업로드 (있으면)
├─ [게시] 클릭
└─ 게시 URL 복사

소요 시간: 5~10분 (수동 작업, 이미지 작업 포함)
```

### 14단계: 성과 기록

```
사용자가 Performance Logger에 입력:
입력 필드 (4개만):
├─ 게시 플랫폼 선택 (블로그)
├─ 게시 URL 붙여넣기
├─ 조회수 숫자 입력 (2시간 후)
├─ 클릭 수 입력 (필수)
└─ 직접 수익 입력 (optional, 나중에)

POST /api/performance-logs
├─ content_package_id
├─ platform: "naver_blog"
├─ post_url: "..."
├─ views: 250
├─ clicks: 12
├─ direct_revenue: 3500 (쇼핑커넥트 수익)
└─ hook_type: "problem_empathy"  (어떤 유형의 제목이 효과 봤는지)

응답:
├─ 성과 로그 저장
├─ company_memory에 반영 시작
│  ├─ "이 후킹 유형은 자취 카테고리에서 평균 250 조회"
│  ├─ "제습기 상품은 이 각도에서 평균 3500 수익"
│  └─ "이 제목은 낚시성이 없으면서도 250+ 조회 달성"
└─ 다음 Paperclip 의사결정에 반영

소요 시간: < 2분
```

### 15단계: 회고 및 다음 의사결정 준비

```
분석 자동 처리:
├─ Analytics Engine이 성과 분석
├─ Company Memory 패턴 저장:
│  ├─ 후킹 유형별 평균 조회수
│  ├─ 상품 카테고리별 평균 수익
│  ├─ 검색 키워드 클릭율
│  └─ 실패 패턴 (조회수 < 100)
└─ 내일 아침 Hermes 스캔 시:
  ├─ 어제 잘 된 후킹 유형 → "오늘도 이 유형의 제목 생성 +20점"
  ├─ 어제 잘 된 상품 → "비슷한 카테고리 우선순위 +15점"
  └─ 어제 클릭 많은 키워드 → "관련 기회 발굴 우선순위"

내일 아침 6시:
├─ Hermes 스캔 (위의 학습 반영)
└─ Paperclip HQ 접속 → 1단계로 반복
```

---

## 2. 상태값 전이 상세

### 기본 경로

```
opportunity_found
  ↓ [사용자 선택]
paperclip_review → selected
  ↓ [Paperclip Decision 생성]
assigned
  ↓ [모든 Desk 시작]
brief_created
  ↓ [HomeFeed 완료]
homefeed_packaged
  ↓ [Search 완료]
search_structured
  ↓ [ShoppingConnect 완료]
revenue_links_attached
  ↓ [Blog 완료]
blog_draft_generated
  ↓ [SNS 완료, Phase 2]
sns_repurposed
  ↓ [Compliance 완료]
compliance_checked (→ compliance_checks.pass = true)
  ↓ [export_allowed = true, 승인 대기열 진입]
owner_approval_required
  ↓ [사용자 [승인] 클릭 — StatusTransition(actor='owner') 기록 = 승인 감사 원장]
approved
  ↓ [Export 실행]
exported
  ↓ [사용자 수동 게시]
published_manually
  ↓ [성과 기록]
performance_recorded
  ↓ [Company Memory 반영]
memory_updated
  ↓ [아카이브]
archived
```

### 예외 경로 1: 검수 실패

```
compliance_checked (compliance_checks.pass = false, high_risk > 0)
  ↓ [사용자 알림]
사용자 [수정] 클릭
  ↓ [Draft 편집]
blog_draft_generated (상태 되돌림)
  ↓ [AI 재처리 또는 사용자 수정]
compliance_checked (재검수)
  ├→ PASS → owner_approval_required → [승인] → approved → exported
  └→ FAIL → 반복

※ 승인 단계에서 [반려] 클릭 시: 반려 사유 입력(선택) → blog_draft_generated로 되돌림 → 수정 후 재검수
   (반려 기록도 StatusTransition에 남음 — council-report §4-1 확정: 승인 상태 정식 채택, 2026-07-02)
```

### 예외 경로 2: 보류 또는 폐기

```
paperclip_review
  ├→ [보류] on_hold
  │  └─ Hermes Desk 필터 탭 → on_hold 카드 재노출
  │  └─ 나중에 재검토 가능
  └→ [폐기] rejected
    └─ 영구 제외
```

### 예외 상태

```
stale: 가격 기준일이 7일 이상 지났을 때
  └─ Compliance Gate에서 자동 감지
  └─ 사용자 [가격 갱신] 버튼으로 업데이트

duplicate: 비슷한 주제를 최근 30일 내에 발행했을 때
  └─ Hermes 스캔 시 자동 감지
  └─ opportunity_memos.status = 'duplicate'로 마킹

needs_research: 필요한 데이터가 부족할 때
  └─ Hermes가 판단, opportunity_memos에 기록

low_revenue_fit: 수익 점수가 50 이하
low_homefeed_fit: 홈피드 점수가 60 이하
  └─ Paperclip HQ에서 선택 전 경고

policy_risk: 고위험 카테고리 (건강, 의료, 투자, 법률)
  └─ blocked_categories 자동 필터링
```

---

## 3. 예외 흐름

### 예외 흐름 1: 검수 실패 (대가성 문구 누락)

```
상황: Blog Desk가 블로그 생성, Compliance가 검수

검수 결과:
├─ 쇼핑커넥트 링크 5개 존재
├─ 대가성 문구? → 없음
└─ risk_level: high

사용자에게:
├─ 경고: "이 글은 쇼핑커넥트 링크가 있으므로 대가성 문구가 필수입니다."
├─ 추천 수정: "이 글은 쇼핑커넥트 링크를 포함하고 있습니다." (상단에 추가)
└─ [자동 수정 적용] 또는 [수정] 선택

자동 수정:
├─ 추천 문구 자동 상단 삽입
├─ 다시 Compliance 검수
└─ PASS → export_allowed = true

사용자 수정:
├─ Draft 에디터 열기
├─ 사용자가 직접 문구 추가
├─ [재검수] 클릭
└─ Compliance 다시 처리
```

### 예외 흐름 2: Naver 검색 API 장애

```
상황: 매일 아침 6시, Hermes가 Naver API 호출 → 타임아웃

에러 로깅:
├─ error_logs 테이블: code='NAVER_API_TIMEOUT', severity='high'
├─ 사용자에게 알림 X (백그라운드 처리)
└─ 시스템은 폴백으로 진행

폴백 로직:
├─ 이전 스캔 결과 (최근 1주일) 재사용
├─ AI로 "어제와 유사하지만 다른 각도" 기회 생성
└─ opportunity_memos에 저장 (source='fallback' 마킹)

사용자 경험:
├─ 아침 HQ에 접속
├─ "오늘은 최근 스캔 결과 기반 기회입니다. [새로 스캔]"
└─ 사용자는 평소대로 진행 가능
```

### 예외 흐름 3: 가격 정보 오래됨

```
상황: 블로그에 "미니 제습기 45,000원" 포함, price_checked_at = 2026-06-20

Compliance 검수:
├─ 오늘(2026-07-02)과 비교 → 12일 차이
├─ 7일 초과(stale)이므로 warning (medium risk)
├─ 하지만 "가격 변동 가능" 문구 있으면 OK

사용자에게:
├─ 경고: "가격이 12일 전 정보입니다. 변동 가능 표기가 있으신가요?"
├─ [변동 가능 문구 추가] 또는 [가격 갱신]
└─ 변동 가능 문구 추가 → export_allowed = true

또는:
├─ 사용자가 [가격 갱신] 클릭
├─ 네이버 쇼핑 페이지로 링크 이동 (사용자가 확인)
├─ 현재 가격 45,500원 입력
├─ price_checked_at 업데이트 (2026-07-02)
└─ 다시 Compliance → PASS
```

### 예외 흐름 4: 네이버 클립 정보태그/쇼핑태그 필요

```
상황: Phase 2, SNS Desk가 클립 대본 생성

Naver Clip Desk 출력:
├─ clip_script (20~30초 대본)
├─ opening_hook (0~2초 문제 제기)
├─ scene_plan (장면 계획)
├─ tag_memo (정보태그/쇼핑태그 메모)
│  ├─ 정보태그: "자취방 습기 제거", "자취팁"
│  └─ 쇼핑태그: "제습제", "제습기", "탈취제" + 링크
└─ blog_cta ("자세한 비교는 블로그에서")

사용자 게시:
├─ clips.naver.com 접속
├─ 대본 참고해서 동영상 촬영 (또는 이미지 시퀀스)
├─ 메모된 정보태그/쇼핑태그 추가
└─ [저장]

이 단계에서:
├─ 자동 게시 불가 (영상 직접 촬영)
├─ 자동 태그 적용 불가 (수동 추가)
└─ 사용자의 크리에이티브 판단 필요
```

### 예외 흐름 5: 첫 실행 또는 프로필 미설정 (E1 — fail-closed 가드)

```
상황: 초기 사용자 또는 company_profile이 미설정 상태에서 기회 발굴 시도

차단 지점:
├─ Hermes 스캔 시 (1단계)
│  └─ company_profile 존재 여부 확인
│     ├─ Y → 정상 진행
│     └─ N → fail-closed 차단, 사용자에게 설정 알림 표시
├─ 사용자 기회 선택 시 (3~4단계)
│  └─ 선택 직전 company_profile 재확인
│     ├─ Y → 정상 진행
│     └─ N → 팝업 경고 + "/settings로 이동" 버튼
└─ 설정 화면 최초 진입 (아직 회사명 없음)
  └─ 필수 필드(company_name) 강조 + 저장 가능할 때까지 진행 불가

설정 화면 상태:
├─ 빈 프로필 상태: "아직 설정이 완료되지 않았습니다"
├─ 회사명 필수 입력 표기
└─ 저장 전까지 다른 탭 접근 가능하지만, Hermes/Content 탭은 비활성화

사용자 경험:
├─ "/settings" 접속 → 회사명 입력 권유 모달
├─ 회사명 + 카테고리 최소 입력 후 [저장]
└─ 설정 저장 → HQ로 자동 리디렉트 + "설정 완료! Hermes 스캔 시작" 메시지
```

---

## 4. 성능 기록 입력 최소화

사용자 입력 필드 (정말 4개만):

```
필드 1: 플랫폼 선택
└─ 드롭다운: "네이버 블로그" / "네이버 클립" / "Instagram" / "Threads" / "X"

필드 2: 게시 URL
└─ 텍스트 입력: "https://blog.naver.com/..."

필드 3: 조회수 (필수)
└─ 숫자 입력: 250

필드 4: 클릭 수 (필수)
└─ 숫자 입력: 12

(5번째 필드가 있다면)
필드 5: 후킹 유형 (선택)
└─ 드롭다운: "문제공감" / "실수지적" / "비교선택" / ...
```

**총 입력 시간**: < 2분

---

## Loop Metadata

- **Upstream documents referenced**: 00-source-plan.md (6장 워크플로우, 10장 상태값), 01-prd.md (운영 흐름), 02-trd.md (API 설계)
- **Downstream documents affected**: 04-database-design.md (상태값 스키마), 06-screens.md (화면 설계 및 입력 필드), 07-coding-convention.md (상태값 관리 규칙)
- **Open questions**: 게시 후 실제 성과 수집 시간 (2시간 vs 하루?), Performance Logger의 추가 필드 필요 여부, 비디오 업로드 시 시간 추가
- **Assumptions**: 사용자가 매일 성과를 기록한다, Naver API는 99% 가용성, 사용자는 게시물 URL을 자동으로 확인할 수 있다
