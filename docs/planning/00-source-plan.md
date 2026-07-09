# Paperclip Company OS 개발기획서 v0.7

> v0.6 원본 + 2026-07-02 기획 확정 결정사항 반영본.
> 이 파일이 프로젝트의 기준 문서(source of truth)입니다.

---

## ⭐ 확정 결정사항 (2026-07-02, v0.6 → v0.7)

| 항목 | v0.6 원안 | v0.7 확정 |
|------|-----------|----------|
| Hermes 데이터 소스 | 네이버 API 연동은 Phase 3 | **네이버 블로그·쇼핑 검색 API를 MVP(Phase 1)로 앞당김** — 첫날부터 실제 데이터 기반 Opportunity Memo |
| 점수 모델 | 변수 11개 가중치 공식 | **홈피드/검색/수익/리스크 4축 단순화** + 각 점수에 근거 문장 필수. 성과 데이터가 쌓이면 정교화 |
| 백엔드 | Next.js API Routes 또는 NestJS | **Next.js API Routes 로컬 실행** (개인 PC에서 `npm run dev/start`, 외부 배포 없음) |
| ORM/운영 | Prisma 또는 Drizzle / 클라우드 DB 또는 로컬 DB | **Prisma + 로컬 PostgreSQL + 로컬 파일 저장소** — Vercel/Supabase는 사용하지 않음 |
| AI 모델 | OpenAI API | **미결(Open Question)** — 모델 교체 가능한 인터페이스로 설계. 후보: Claude API / OpenAI API / 작업별 라우팅 |
| 하루 운영 시간 | 미정 | **30분 이내** → 입력 최소화가 UI 설계 1순위. 상품 등록은 URL 붙여넣기 수준, 성과 기록은 숫자 3~4개만 |
| Phase 2 조건 | 없음 | Phase 2(클립/SNS) 진입 시 채널별 수동 게시 시간을 실측하고, 30분 예산 초과 시 채널 수 조정 |

---

기준일: **2026년 7월 1일**
제품 방향: **1인 AI 미디어커머스 회사 운영 OS**
핵심 목표: **네이버 홈피드·검색·클립·SNS 유입을 만들고, 쇼핑커넥트 직접 실적 중심으로 수익화하는 개인용 AI 회사 시스템**

---

## 1. 제품 정의

**Paperclip Company OS**는 사용자가 혼자 운영하지만, 내부적으로는 여러 부서가 있는 회사처럼 작동하는 AI 미디어커머스 운영 시스템이다.

이 시스템의 핵심 구조는 다음과 같다.

```text
Hermes는 플랫폼 내부의 시장조사 부서다.
Paperclip은 플랫폼 전체를 감싸는 경영·판단·승인 레이어다.
Content Engine은 실제 콘텐츠를 만든다.
Channel Profiles는 블로그, 클립, 인스타그램, Threads, X의 문법을 적용한다.
ShoppingConnect Engine은 수익 동선을 설계한다.
Compliance Engine은 광고표시, 가격, 출처, 과장 표현을 막는다.
Analytics / CFO Engine은 성과와 수익을 기록한다.
```

한 줄 정의:

> **Hermes가 시장 기회를 찾고, Paperclip이 오늘의 전략과 작업을 결정하고, 부서형 AI Agent들이 블로그·홈피드·쇼핑커넥트·클립·SNS·검수·성과분석을 수행하며, 사용자는 최종 오너로 승인하는 1인 AI 미디어커머스 회사 운영체제.**

이 제품은 단순한 "AI 글쓰기 도구"가 아니다.

```text
시장 탐색
→ 기회 발굴
→ 홈피드/검색/수익성 점수화
→ 오늘의 콘텐츠 결정
→ 블로그 원문 생성
→ 쇼핑커넥트 수익 동선 설계
→ 네이버 클립/SNS 변환
→ 컴플라이언스 검수
→ 사용자 승인
→ 수동 게시
→ 성과 기록
→ 다음 전략 개선
```

을 수행하는 **1인 회사 운영체제**다.

---

## 2. 정책·플랫폼 전제

- 네이버 홈피드는 검색홈 하단 추천 콘텐츠 피드. 로그인 사용자의 활동·관심사 기반 개인화 노출. → Paperclip은 **관심사 기반 홈피드 패키징**을 함께 설계한다.
- 홈피드 세부 랭킹 로직은 외부에서 알 수 없음 → "노출 보장"이 아니라 **홈피드 적합도 점수**를 내부 계산.
- 네이버 블로그 글쓰기 API는 2020-05-06 종료 → MVP에서 자동 발행 제외, **Markdown/HTML/복사용 Export + 수동 게시**.
- 서치어드바이저 가이드: 명확한 제목·본문 구조·비교표·FAQ·자연스러운 키워드 회수.
- 쇼핑커넥트: 판매자가 등록한 상품만 링크 발급 가능. 직접 실적(본인 링크로 해당 상품 직접 조회 후 주문, 상품별 수수료) vs 간접 실적(24시간 내 다른 상품 구매, 기본 1.8%). 유입 유효 24시간, 집계 유효 7일 → **특정 상품을 직접 클릭하게 만드는 구조**에 집중.
- 네이버 클립에서도 쇼핑커넥트 스티커 사용 가능, 대가성 문구 필요. 블로그·클립·Instagram·YouTube 중 1개 채널만 있으면 구독자 수 제한 없이 이용 가능.
- 클립 정보 태그 → 네이버 앱 홈피드·검색·플레이스·지도·플러스스토어 노출 가능 → 블로그 원문 1개당 클립 대본 + 정보태그/쇼핑태그 메모 함께 생성.
- Instagram/Facebook은 AI 랭킹, Threads는 텍스트 대화형, X For You는 상호작용 신호 기반 → SNS 변환은 단순 요약이 아니라 채널별 행동 목표에 맞게 다시 쓴다.

참고 링크: 네이버 고객센터(홈피드/쇼핑커넥트), NAVER D2, 네이버 개발자센터, 서치어드바이저, mkt.naver.com 클립 프로필, Meta/X 공식 문서 (원본 v0.6 각주 참조)

---

## 3. 제품 핵심 컨셉

> **내가 혼자지만, 내부는 회사처럼 돌아간다.**

| 회사 부서 | 시스템 이름 | 역할 |
| ------- | -------------------------- | ------------------------------- |
| 경영실 | `Paperclip HQ` | 목표 설정, 오늘의 전략, 우선순위, 승인, 리스크 판단 |
| 시장조사팀 | `Hermes Research Division` | 키워드, 트렌드, 상품, 홈피드 신호, 경쟁 콘텐츠 조사 |
| 기획팀 | `Brief Desk` | 수집 데이터를 콘텐츠 기획안으로 변환 |
| 홈피드전략팀 | `HomeFeed Desk` | 홈판형 제목, 썸네일 문구, 첫 화면 구조 설계 |
| 검색전략팀 | `Search Desk` | 검색 키워드, H2/H3, FAQ, 비교표 설계 |
| 수익화팀 | `ShoppingConnect Desk` | 상품 선정, 링크 배치, 직접 실적 유도 설계 |
| 블로그 제작팀 | `Naver Blog Desk` | 네이버 블로그 원문 생성 |
| 클립 제작팀 | `Naver Clip Desk` | 네이버 클립 대본, 정보태그/쇼핑태그 메모 생성 |
| SNS 제작팀 | `Social Desk` | Instagram, Threads, X 변환 |
| 검수팀 | `Compliance Desk` | 광고표시, 가격 기준일, 출처, 과장 표현 검수 |
| 재무분석팀 | `Analytics / CFO Desk` | 조회수, 클릭, 직접/간접 실적, 수익 분석 |
| 기억관리팀 | `Company Memory` | 잘 된 주제, 후킹, 상품, 실패 패턴 저장 |

개발 구조에서는 처음부터 모든 채널 Agent를 물리적으로 분리하지 않는다.

```text
초기 구현:
Paperclip HQ / Hermes Research / Master Content Engine
/ ShoppingConnect Revenue Engine / Compliance Engine / Analytics·Memory Engine

채널별 차이 → Channel Profile:
NaverBlogProfile / NaverClipProfile / InstagramProfile / ThreadsProfile / XProfile

카테고리별 차이 → Category Playbook:
자취·원룸 / 장마·계절템 / 청소·냄새 / 수납·정리 / 선물추천 / 소형가전
```

---

## 4. 전체 시스템 구조

```text
사용자 / Owner
    ↓
Paperclip HQ
    ↓
Platform Core (Database / Job Runner / Policy Rules / Company Memory / Export System)
    ↓
Hermes Research Division (Trend Scanner / Keyword Scout / ShoppingConnect Product Scout
                          / Competitor Watcher / HomeFeed Signal Mapper)
    ↓
Content Production Layer (Brief / HomeFeed / Search / ShoppingConnect
                          / Naver Blog / Naver Clip / Social Desk)
    ↓
Compliance Desk
    ↓
Owner Approval
    ↓
Export / Manual Publish
    ↓
Analytics / CFO Desk
    ↓
Company Memory
    ↓
Paperclip HQ의 다음 의사결정 개선
```

원칙:

```text
Hermes는 제안한다.
Content Engine은 만든다.
ShoppingConnect Engine은 수익 동선을 설계한다.
Compliance Engine은 막는다.
Paperclip은 판단한다.
사용자는 최종 승인한다.
```

---

## 5. MVP 범위

MVP는 "완전 자동 회사"가 아니라 **회사처럼 돌아가는 최소 운영 루프**다.

### MVP 목표

> **매일 1개의 수익형 콘텐츠 패키지를 기획·생성·검수·게시 준비·성과 기록할 수 있게 만든다.**

### MVP 포함 기능

| 우선순위 | 기능 | 설명 |
| ---: | ----------------------- | -------------------------------------- |
| 1 | Paperclip HQ 메인페이지 | 오늘의 기회, 제작 상태, 검수 상태, 수익 상태를 한 화면에서 확인 |
| 2 | Hermes Opportunity Memo | 오늘 쓸 만한 주제 후보를 보고서 형태로 생성 (**네이버 블로그·쇼핑 검색 API 실데이터 기반** — v0.7) |
| 3 | 주제 점수화 | **홈피드/검색/수익/리스크 4축** 점수화 + 근거 문장 (v0.7 단순화) |
| 4 | 홈판형 제목 생성 | 피드에서 클릭될 제목, 썸네일 문구, 첫 화면 구조 생성 |
| 5 | 검색형 구조 생성 | 검색형 제목, 키워드 클러스터, H2/H3, FAQ, 비교표 생성 |
| 6 | 쇼핑커넥트 상품/링크 관리 | 상품명, 가격, 링크, 수수료율, 확인일 저장 (**URL 붙여넣기 수준으로 입력 최소화** — v0.7) |
| 7 | 블로그 원문 생성 | 홈피드 + 검색 + 쇼핑커넥트 수익형 블로그 본문 생성 |
| 8 | 네이버 클립 대본 생성 | 20~30초 숏폼 대본, 정보태그/쇼핑태그 메모 생성 |
| 9 | SNS 변환 | Instagram 캐러셀, Threads, X 문장 생성 |
| 10 | Compliance Gate | 대가성 문구, 가격 기준일, 출처, 과장 표현 검수 |
| 11 | Export Bundle | Markdown, HTML, 복사용 본문, ZIP 번들 출력 (SNS 복사용은 Phase 2) |
| 12 | Performance Logger | 게시 URL, 조회수, 클릭, 수익, 후킹 유형 기록 (**숫자 3~4개만 입력** — v0.7) |
| 13 | Company Memory | 잘 된 제목, 상품, 카테고리, 실패 원인 저장 |

### MVP 제외 기능

| 제외 기능 | 이유 |
| ------------------------- | ------------------------------------ |
| 네이버 블로그 자동 발행 | 글쓰기 API 종료 및 정책 리스크 |
| Instagram/Threads/X 자동 발행 | OAuth, 권한, 정책, 운영 복잡도 대비 초기 수익 효과 낮음 |
| 쇼핑커넥트 자동 스크래핑 | 로그인/약관/권한 리스크 |
| 완전 자동 대량 발행 | 홈피드 숨김, 저품질, 광고글 피로도 리스크 |
| 멀티유저 SaaS | 현재 목표는 1인 회사 운영 |
| 결제/구독 시스템 | SaaS가 아니므로 불필요 |
| 만세력 엔진 | 현재 수익형 미디어커머스 핵심과 분리 |
| 영상 자동 생성 | 초기에는 클립 대본까지만 생성 |

---

## 6. 핵심 워크플로우 (하루 운영 흐름)

```text
1. 사용자가 Paperclip HQ에 접속한다.
2. Hermes가 오늘의 Opportunity Memo 3~5개를 보여준다.
3. Paperclip이 각 주제의 홈피드/검색/수익/리스크 4축 점수를 매긴다.
4. 사용자는 오늘 제작할 주제 1개를 승인한다.
5. HomeFeed Desk가 홈판형 제목, 썸네일 문구, 첫 화면 구조를 만든다.
6. Search Desk가 검색형 제목, 키워드 클러스터, FAQ, 비교표를 만든다.
7. ShoppingConnect Desk가 상품별 추천 위치와 CTA를 설계한다.
8. Naver Blog Desk가 블로그 원문을 생성한다.
9. Naver Clip Desk와 Social Desk가 클립/SNS 변환본을 만든다. (Phase 2)
10. Compliance Desk가 광고표시, 가격 기준일, 출처, 과장 표현을 검사한다.
11. 통과한 콘텐츠만 Export 가능 상태가 된다.
12. 사용자가 네이버 블로그, 클립, SNS에 수동 게시한다.
13. 게시 URL과 성과를 Performance Logger에 기록한다.
14. Analytics / CFO Desk가 성과를 Company Memory에 반영한다.
15. Paperclip은 다음 주제 선택에 이 데이터를 활용한다.
```

---

## 7. 핵심 엔진 설계

### 7.1 Paperclip HQ (경영 레이어)

```text
- 오늘의 운영 목표 확인 / Hermes 보고서 검토 / 주제 선택·보류·폐기
- 작업 배정 / 상태 관리 / 검수 결과 판단
- 수익성 기반 우선순위 조정 / Company Memory 기반 다음 전략 제안
```

Paperclip Decision 예시:

```json
{
  "decision_id": "dec_20260701_001",
  "topic": "장마철 자취방 습기 제거템",
  "decision": "selected",
  "reason": [
    "자취/장마/생활템 관심사 적합도 높음",
    "쇼핑커넥트 상품 연결이 자연스러움",
    "홈피드형 후킹 제목 생성 가능",
    "검색형 롱테일 키워드도 확보 가능"
  ],
  "assigned_profiles": ["NaverBlogProfile", "NaverClipProfile", "InstagramProfile", "ThreadsProfile", "XProfile"],
  "requires_owner_approval": true,
  "status": "assigned"
}
```

### 7.2 Hermes Research Division (기회 발굴 부서)

```text
- 시즌성 이슈 탐색 / 키워드 후보 생성 / 홈피드 관심사 태그 매핑
- 검색형 롱테일 키워드 구성 / 쇼핑커넥트 상품 연결 가능성 판단
- 경쟁 콘텐츠 제목·각도 분석 / 위험 카테고리 필터링
- Paperclip에게 Opportunity Memo 제출
- (v0.7) 네이버 블로그·쇼핑 검색 API로 실데이터 수집
```

Opportunity Memo 예시:

```json
{
  "memo_id": "opp_001",
  "topic": "장마철 자취방 습기 제거템",
  "why_now": "장마 시즌과 자취/원룸 생활템 관심사가 결합됨",
  "homefeed_angle": "자취방 냄새, 청소보다 습기 문제일 수 있어요",
  "search_angle": "장마철 자취방 습기 제거템 추천: 제습제·미니제습기 비교",
  "interest_tags": ["자취", "원룸", "장마", "생활꿀팁", "집관리"],
  "homefeed_score": 78,
  "search_score": 74,
  "revenue_score": 82,
  "risk_score": 38,
  "score_reasons": "장마 시즌성, 검색 수요, 제습제/미니제습기 직접 클릭 동선은 강하나 가격 기준일과 대가성 문구 검수가 필요",
  "content_package_recommendation": ["naver_blog", "naver_clip", "instagram_carousel", "threads", "x"],
  "paperclip_recommendation": "publish_candidate"
}
```

### 7.3 Master Content Engine

채널별 Agent를 물리 분리하지 않고 공통 Content Engine + Channel Profile.

입력: `{ brief, products, shopping_connect_links, source_facts, channel_profile, category_playbook, policy_rules }`
출력: `{ channel, draft, claims, required_disclosures, price_notices, risk_notes, export_blocks }`

이점: 정보 일관성, 비용 절감, 프롬프트 관리 단순화, 채널별 규칙 변경 용이, 성과 좋은 채널만 나중에 독립 분리 가능.

### 7.4 Channel Profiles

**NaverBlogProfile** — 목표: 홈피드+검색 동시 고려 수익형 블로그 원문
- 홈판형/검색형 제목 분리, 첫 화면에서 공감·결론 먼저, 비교표·FAQ 포함
- 쇼핑커넥트 링크 있으면 대가성 문구 상단, 가격 기준일 필수, 미사용 상품 후기체 금지
- 출력: homefeed_title, search_title, thumbnail_text, first_screen, blog_body, comparison_table, faq, price_notice

**NaverClipProfile** — 목표: 네이버 내부 발견 + 블로그 재방문 유도 숏폼 대본
- 0~2초 문제 제기, 20~30초 해결 리스트, 블로그 비교표로 연결, 정보태그/쇼핑태그 메모, 대가성 문구 필요 표시
- 출력: clip_script, opening_hook, scene_plan, tag_memo, blog_cta

**InstagramProfile** — 목표: 저장·공유 유도 캐러셀/릴스/캡션
- 첫 장 강한 후킹, 정보는 짧고 시각적, 저장 CTA, 블로그 그대로 요약 금지
- 출력: carousel_slides, caption, hashtags, reels_script, cta

**ThreadsProfile** — 목표: 공감·답글 유도 대화형 짧은 글
- 블로그 요약체 금지, 첫 문장은 관찰·공감, 마지막은 질문형, 링크는 부드럽게
- 출력: post_series, question_ending, soft_cta

**XProfile** — 목표: 짧고 선명한 관점, 반응 유도
- 한 문장에 관점, 길게 설명 금지, 링크 첫 문장 금지, 스레드 각 문장 독립적
- 출력: single_posts, thread, hook_variants

### 7.5 HomeFeed Optimizer

노출 보장 엔진이 아니라 홈피드 적합도 내부 판단 엔진.

**(v0.7) 점수는 4축으로 단순화:**

```text
homefeed_score  : 관심사 명확성 + 후킹 강도 + 첫 화면 품질 - 낚시 위험 (AI 루브릭 채점 + 근거 문장)
search_score    : 검색 수요 + 키워드 구조 적합성 (AI 루브릭 채점 + 근거 문장)
revenue_score   : 문제-상품 적합 + 직접 클릭 의도 + 수수료 (AI 루브릭 채점 + 근거 문장)
risk_score      : 컴플라이언스 위험 + 광고 피로도 (낮을수록 좋음)
```

> 원본 v0.6의 11변수 가중치 공식은 성과 데이터가 쌓인 후(Phase 4+) 정교화 시 참고용으로 보존한다.
> 각 점수에는 반드시 "왜 이 점수인지" 근거 문장을 함께 출력한다.

홈판형 제목 공식 (유형 7종):

```text
문제 공감형: 자취방 냄새, 청소보다 습기 문제일 수 있어요
실수 지적형: 방향제부터 사면 냄새 해결이 늦을 수 있어요
비교 선택형: 원룸은 제습제와 미니 제습기 중 뭐가 나을까
시즌 긴급형: 장마 시작 전에 봐야 할 자취방 습기템
체크리스트형: 장마 전 자취방에서 확인할 5가지
반전형: 자취방 냄새는 방향제보다 제습이 먼저입니다
구역분리형: 옷장·침대 밑·신발장은 제습템이 달라야 해요
```

### 7.6 ShoppingConnect Revenue Engine

핵심 목표: "링크 많이 넣기"가 아니라 **해당 상품을 직접 클릭할 이유 만들기**.

(v0.7) 상품 점수도 4축 루브릭에 통합 — revenue_score의 세부 근거로: 문제-해결 적합 / 직접 클릭 의도 / 수수료율 / 반품·실망 위험.

링크 배치 원칙:

```text
상단: 쇼핑커넥트 대가성 문구
초반: 문제 공감과 결론, 링크 최소화
중반: 비교표 안에 상품별 링크
개별 상품 섹션: 상품별 추천 상황 설명 후 CTA
하단: 상황별 최종 추천 정리, 가격 기준일과 링크 확인일
```

좋은 CTA:

```text
옷장처럼 좁은 공간 위주라면 이 제품이 더 맞습니다.
가격과 현재 옵션은 상품 페이지에서 다시 확인해보세요.
```

금지 CTA:

```text
무조건 이거 사세요. / 100% 냄새 사라집니다. / 최저가 링크입니다. / 이거 안 사면 후회합니다.
```

### 7.7 Compliance Engine

반드시 독립 엔진. 규칙 기반 검수 + LLM 의미 검수 병행.

필수 검수 항목:

```text
[쇼핑커넥트] 링크 존재 여부 / 대가성 문구 존재·위치 / 활동 제한 채널 여부
[가격] 가격 포함 여부 / 가격 확인일 존재 / 변동 가능성 문구
[출처] 상품명·가격·스펙 출처 / 상품 링크 / 수집·확인 시점
[표현] 100%·무조건·완벽·최저가·1위·최고 / 미사용 상품 후기체 / 건강·효능·안전성 단정
[게시 가능] high risk 존재 시 Export 금지 / medium risk는 사용자 확인 필요
```

검수 출력 예시:

```json
{
  "pass": false,
  "risk_level": "medium",
  "issues": [
    {
      "type": "price_checked_at_missing",
      "severity": "medium",
      "message": "상품 가격이 포함되어 있으나 가격 확인일이 없습니다.",
      "suggested_fix": "가격은 2026년 7월 1일 확인 기준이며 변동될 수 있습니다."
    }
  ],
  "export_allowed": false
}
```

---

## 8. 콘텐츠 패키지 산출물 (주제 1개당)

```text
1. Hermes Opportunity Memo        2. Paperclip Decision
3. 홈판형 제목 10개                4. 검색형 제목 5개
5. 썸네일 문구 5개                 6. 첫 화면 5초 구조
7. 네이버 블로그 원문              8. 비교표
9. FAQ                            10. 쇼핑커넥트 링크 배치표
11. 네이버 클립 대본               12. Instagram 캐러셀 6장
13. Threads 글 2~3개              14. X 단문 2~3개
15. Compliance Report             16. Export Bundle
17. 게시 후 Performance Log
```

---

## 9. 데이터베이스 설계

### 핵심 테이블 목록

```text
company_profile / operating_goals / sources / raw_items
opportunity_memos / paperclip_decisions / topics / keyword_clusters
interest_categories / category_playbooks / products / shopping_connect_links
content_packages / drafts / content_blocks / sns_variants
compliance_checks / compliance_issues / exports / publishing_logs
performance_logs / revenue_logs / company_memory / prompt_templates
agent_runs / policy_rules / cost_logs / error_logs
```

### 주요 테이블 상세

`company_profile`: id, company_name, primary_categories, blocked_categories, tone_rules, content_principles, revenue_goal_monthly, created_at, updated_at

`opportunity_memos`: id, topic, why_now, homefeed_angle, search_angle, interest_tags, homefeed_score, search_score, revenue_score, risk_score, score_reasons, recommended_package, status, created_at

`paperclip_decisions`: id, opportunity_memo_id, decision, reason_json, assigned_profiles, priority, requires_owner_approval, created_at

`products`: id, topic_id, product_name, product_url, source, price, price_checked_at, image_url, category, memo, created_at

`shopping_connect_links`: id, product_id, shopping_connect_url, commission_rate, bonus_commission, direct_performance_score, link_checked_at, is_active, notes, created_at

`content_packages`: id, topic_id, status, homefeed_score, search_score, revenue_score, publish_readiness, created_at, updated_at

`drafts`: id, content_package_id, channel, homefeed_title, search_title, thumbnail_text, body_markdown, disclosure_text, price_notice, status, created_at, updated_at

`sns_variants`: id, content_package_id, platform, format, hook, body, cta, score, created_at

`compliance_checks`: id, content_package_id, draft_id, risk_level, pass, export_allowed, checked_at

`performance_logs`: id, content_package_id, platform, post_url, title_used, hook_type, views, clicks, likes, comments, saves, shares, direct_revenue, indirect_revenue, recorded_at

`company_memory`: id, pattern_type, category, pattern_text, tags, sample_count, result_summary, score, evidence_json, created_at (어휘 정본: 02-trd §2.6 A9)

---

## 10. 상태값 설계

```text
opportunity_found → paperclip_review → selected → assigned
→ brief_created → homefeed_packaged → search_structured → revenue_links_attached
→ blog_draft_generated → sns_repurposed → compliance_checked
→ owner_approval_required → approved → exported
→ published_manually → performance_recorded → memory_updated
```

예외 상태:

```text
rejected / duplicate / stale / needs_research / needs_link_refresh
/ compliance_failed / price_outdated / policy_risk
/ low_revenue_fit / low_homefeed_fit / archived
```

---

## 11. API 설계

### Paperclip HQ
```http
GET  /api/hq/today
POST /api/hq/daily-briefing
GET  /api/hq/status
POST /api/hq/decisions
GET  /api/hq/decisions/:id
POST /api/hq/decisions/:id/approve
POST /api/hq/decisions/:id/reject
```

### Hermes
```http
POST /api/hermes/scan
POST /api/hermes/scan/keyword
POST /api/hermes/scan/naver-shopping
POST /api/hermes/scan/naver-blog
POST /api/hermes/opportunity-memos
GET  /api/hermes/opportunity-memos
GET  /api/hermes/opportunity-memos/:id
```

### Content Package
```http
POST /api/content-packages
GET  /api/content-packages
GET  /api/content-packages/:id
POST /api/content-packages/:id/generate
POST /api/content-packages/:id/generate-blog
POST /api/content-packages/:id/generate-sns
POST /api/content-packages/:id/export
```

### HomeFeed / Search
```http
POST /api/optimizers/homefeed/score
POST /api/optimizers/homefeed/titles
POST /api/optimizers/search/structure
POST /api/optimizers/search/faq
POST /api/optimizers/search/comparison-table
```

### ShoppingConnect
```http
POST /api/products
GET  /api/products
PATCH /api/products/:id
POST /api/shopping-connect-links
PATCH /api/shopping-connect-links/:id
POST /api/shopping-connect/score
POST /api/shopping-connect/link-placement
GET  /api/shopping-connect/revenue-summary
```

### Compliance
```http
POST /api/compliance/check
GET  /api/compliance/checks/:id
POST /api/compliance/checks/:id/apply-fixes
```

### Performance
```http
POST /api/performance-logs
GET  /api/performance-logs
GET  /api/performance/content/:id
GET  /api/performance/category/:category
GET  /api/revenue/summary
GET  /api/memory/winning-patterns
```

---

## 12. 메인페이지 디자인 설계

메인페이지는 일반 대시보드가 아니라 **Paperclip HQ Command Center** — "AI 회사의 아침 경영회의 화면".

들어오자마자 알아야 하는 5가지:

```text
1. 오늘 뭘 만들면 되는지
2. Hermes가 어떤 기회를 찾아왔는지
3. 어떤 콘텐츠가 제작/검수/승인 대기 중인지
4. 쇼핑커넥트 수익 상태가 어떤지
5. 지금 내가 눌러야 할 버튼이 무엇인지
```

### 12.1 전체 레이아웃 (Desktop)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Paperclip Company OS        2026.07.01 Wed        [오늘 브리핑 생성] [설정] │
├───────────────┬──────────────────────────────────────────────┬───────────────┤
│ Sidebar       │ Main Command Center                          │ Right Panel   │
│ ● HQ          │ 1) 오늘의 경영 브리핑                        │ Owner         │
│ ● Hermes      │ 2) Hermes Opportunity Memos                  │ Approval Queue│
│ ● Content     │ 3) Content Production Pipeline (칸반)        │ Compliance    │
│ ● Revenue     │ 4) Winning Patterns                          │ Alerts        │
│ ● Compliance  │                                              │ Revenue       │
│ ● Memory      │                                              │ Snapshot      │
│ ● Reports     │                                              │               │
└───────────────┴──────────────────────────────────────────────┴───────────────┘
```

### 12.2 상단 헤더

좌: 로고 / 중: 오늘 날짜·운영 상태 / 우: [오늘 브리핑 생성] [새 콘텐츠 만들기] [설정]

헤더 상태값: Good(발행 준비 가능) / Warning(검수 실패 있음) / Revenue(수익 기록 필요) / Stale(가격·링크 갱신 필요) / Focus(오늘 주제 선택 필요)

### 12.3 좌측 사이드바 (부서 구조)

```text
HQ: 오늘의 브리핑 / 결정 대기 / 작업 현황
Hermes: 기회 보고서 / 키워드 스캔 / 상품 후보 / 경쟁 콘텐츠
Content Factory: 블로그 / 클립 / Instagram / Threads / X
Revenue Desk: 쇼핑커넥트 상품 / 링크 관리 / 수익 로그 / 직접·간접 실적
Compliance: 검수 대기 / 실패 항목 / 정책 룰
Company Memory: 성공 패턴 / 실패 패턴 / 업데이트 후보
Reports: 일간 리포트 / 주간 회고 / 월간 손익
```

### 12.4 중앙 메인 영역 (4개 블록)

**12.4.1 오늘의 경영 브리핑 카드** (최상단)
- 오늘 목표 (블로그 1 / 클립 1 / SNS 4 등)
- 오늘 집중 카테고리
- Paperclip 판단 한 줄
- [오늘 주제 선택하기] [Hermes 다시 스캔]

**12.4.2 Hermes Opportunity Memos** — 카드 리스트
- 각 카드: 주제 / HomeFeed·Search·Revenue·Risk 4축 점수 / 각도 한 줄 / 추천 채널
- 버튼: [선택] [보류] [폐기] [상세보기]

**12.4.3 Content Production Pipeline** — 칸반
- 컬럼: 기회발굴 → 제작중 → 검수중 → 승인대기 → 게시완료
- 카드: 주제, 현재 상태, 점수, 검수 상태, 다음 액션 버튼

**12.4.4 Winning Patterns**
- 잘 먹힌 후킹 / 수익 난 상품군 / 업데이트 후보 (가격 기준일 갱신 필요 글)

### 12.5 우측 패널

1. Owner Approval Queue (승인 대기 + [미리보기] [승인] / 수정 필요 + [수정])
2. Compliance Alerts (High/Medium/Low 카운트 + 이슈 요약)
3. Revenue Snapshot (이번 달 예상 수익, 직접/간접 실적, 수익 1위 글)
4. Refresh Needed (가격·링크 갱신 필요 목록)

### 12.6 디자인 톤

```text
컨셉: AI 회사의 지휘실 / 깔끔한 SaaS 대시보드 / 네이버 생태계 초록 포인트 / 운영 상황판 느낌

컬러:
Background #F7F8FA / Primary #1F2937 (짙은 회색, 경영 느낌)
Accent Green #03C75A (네이버 계열, 유입·쇼핑커넥트 포인트)
Accent Blue #2563EB (Paperclip 판단·액션 버튼)
Warning #F59E0B / Danger #EF4444 / Card #FFFFFF / Border #E5E7EB

타이포: 메인 제목 18~22px Bold / 카드 제목 15~16px Semibold / 본문 13~14px / 점수 24px Bold / 상태 라벨 12px Medium

UI: 둥근 카드, 약한 그림자, 점수는 칩, 상태는 색상 라벨, 명확한 CTA, 차트보다 오늘 할 일 중심
```

---

## 13. 콘텐츠 상세 페이지

메인에서 Opportunity Memo 클릭 → 상세 화면.

```text
상단: 주제 / 4축 점수 / Compliance Risk / 상태
좌측: Hermes Memo / 키워드 클러스터 / 쇼핑커넥트 상품 후보
중앙: 홈판형·검색형 제목 후보 / 첫 화면 5초 구조 / 블로그 원문 / 비교표 / FAQ
우측: 쇼핑커넥트 링크 배치 / Compliance Checklist / [Export]
```

---

## 14. 기술 스택 (v0.7 확정)

| 영역 | 확정 |
| ---------- | ----------------------------------- |
| Frontend | Next.js (App Router) |
| Backend | **Next.js API Routes** (확정) |
| DB | 로컬 PostgreSQL |
| ORM | **Prisma** (확정) |
| Auth | single_owner_no_login |
| Job Runner | **로컬 스케줄러** (Windows 작업 스케줄러/cron에서 `npm run scan:hermes`) |
| Storage | 로컬 파일 저장소 (`LOCAL_STORAGE_DIR`) |
| AI | **미결 (Open Question)** — 모델 교체 가능한 인터페이스로 설계. 후보: Claude API / OpenAI API / 작업별 라우팅 |
| 외부 API | **네이버 블로그·쇼핑 검색 API (MVP부터)** |
| Export | Markdown, HTML, Copy Block |
| Monitoring | 기본 error_logs, cost_logs |
| 운영 | **로컬 PC 실행** (Vercel/Supabase 사용 안 함) |

---

## 15. 개발 단계

### Phase 0: 기획 고정
```text
- 회사 구조 명칭 확정 / 핵심 카테고리 3개 확정 / 금지 카테고리 확정
- 쇼핑커넥트 운영 규칙 정리 / Compliance 룰셋 작성 / 데이터베이스 v1 확정
```

### Phase 1: Company OS MVP
```text
- Paperclip HQ 메인페이지
- 네이버 블로그·쇼핑 검색 API 연동 (v0.7에서 앞당김)
- Hermes Opportunity Memo 생성 (실데이터 기반)
- 주제 선택/보류/폐기
- 홈판형 제목 생성 / 검색형 구조 생성
- 쇼핑커넥트 상품·링크 등록 (URL 붙여넣기 수준)
- 네이버 블로그 원문 생성
- Compliance Gate
- Markdown/HTML/Copy Export
- 게시 URL·성과 기록 (숫자 3~4개만)
```

### Phase 2: 콘텐츠 패키지 고도화
```text
- 네이버 클립 대본 / Instagram 캐러셀 / Threads·X 변환 / 썸네일 문구
- 후킹 유형별 성과 기록 / Company Memory 적용
- ⚠️ 진입 조건: 채널별 수동 게시 시간 실측 → 하루 30분 예산 초과 시 채널 수 조정
```

### Phase 3: Hermes 자동화 확장
```text
- 키워드 후보 자동 수집 고도화 / 경쟁 콘텐츠 제목 분석
- 시즌 캘린더 / 링크 상태 점검
```

### Phase 4: Revenue Intelligence
```text
- 직접/간접 실적 기록 / 상품별 수익 대시보드 / 글별 ROI 분석
- 수익 없는 글 리라이트 추천 / 링크 갱신 알림 / 고수익 카테고리 추천
- (점수 모델 정교화 검토 — v0.6 11변수 공식 참고)
```

### Phase 5: 진짜 회사 운영 루프
```text
- 매일 아침 자동 브리핑 / 주간 회고 리포트 / 월간 P&L 리포트
- 다음 달 콘텐츠 캘린더 / Paperclip 자동 전략 제안
```

---

## 16. 핵심 점수 모델 (v0.7 — 4축 단순화)

### MVP 점수 체계

```text
각 Opportunity Memo / Content Package에 4축 점수 (0~100) + 근거 문장:

homefeed_score : 홈피드에서 눌릴 글인가 (관심사 명확성, 후킹, 첫 화면 품질, 낚시 위험 감점)
search_score   : 검색에 잡힐 글인가 (검색 수요, 키워드 구조)
revenue_score  : 돈이 되는 글인가 (문제-상품 적합, 직접 클릭 의도, 수수료)
risk_score     : 걸릴 게 있는가 (컴플라이언스 위험, 광고 피로도 — 낮을수록 좋음)
```

발행 가능 기준 (Publish Readiness):

```text
- Compliance Gate 통과 (high risk 0건)
- homefeed_score 또는 search_score ≥ 70
- revenue_score ≥ 65 (수익형 글인 경우)
- 사용자 최종 승인
```

> v0.6의 11변수 opportunity_score / publish_readiness / company_growth_score 공식은
> 성과 데이터 축적 후 정교화 시 참고용으로 보존 (부록 성격).

---

## 17. 운영 원칙

```text
1. 네이버 블로그 자동 발행은 하지 않는다.
2. 모든 게시물은 사용자가 직접 게시한다.
3. 쇼핑커넥트 링크가 있으면 대가성 문구 없이는 Export 불가.
4. 가격이 있으면 가격 기준일 없이는 Export 불가.
5. 직접 써보지 않은 상품을 사용 후기처럼 쓰지 않는다.
6. 건강·투자·법률·의료·다이어트 등 고위험 카테고리는 초기 제외.
7. 홈판 제목은 강하게 만들되, 본문 첫 화면에서 반드시 약속을 회수한다.
8. 링크를 많이 넣는 것보다 특정 상품을 직접 클릭할 이유를 만든다.
9. 블로그 1개를 원본으로 만들고 클립/SNS는 재활용한다.
10. 매일 성과를 기록하고 잘 된 후킹과 상품군만 반복한다.
11. (v0.7) 하루 운영 30분 이내 — 입력 최소화가 모든 UI 설계의 1순위.
```

---

## 18. 리스크와 대응

| 리스크 | 설명 | 대응 |
| -------------- | ----------------- | ---------------------------- |
| 홈피드 노출 보장 불가 | 세부 알고리즘 비공개 | 내부 적합도 점수로 대리 최적화 |
| 낚시성 제목 | 클릭 후 이탈/숨김 유발 | 낚시 위험을 homefeed_score 감점 요인으로 |
| 광고글 피로도 | 링크 과다 배치 시 신뢰 하락 | 링크 수 제한, 문제 해결 우선 |
| 대가성 문구 누락 | 정책·신뢰 리스크 | Compliance Gate에서 Export 차단 |
| 가격 정보 오래됨 | 상품형 글 신뢰도 하락 | price_checked_at, refresh 알림 |
| 직접 사용 후기 위장 | 신뢰·법적 리스크 | actual_use 여부 필드 필수 |
| 자동 발행 리스크 | 네이버 정책 리스크 | 수동 게시 원칙 |
| 정보 과잉 | Hermes 후보가 너무 많음 | 하루 Opportunity Memo 최대 5개 |
| 실행 지연 | 회사 구조만 만들고 게시 안 함 | 매일 콘텐츠 패키지 1개 기준 |
| 쇼핑커넥트 상품 변경 | 상품 비활성/수수료 변경 | link_checked_at, 대체 상품 필드 |
| 네이버 검색 API 쿼터/장애 (v0.7) | API 한도 초과·응답 실패 | 쿼터 모니터링, 실패 시 "이전 스캔 결과 + AI 보완" 폴백 |

---

## 19. 개발 우선순위 최종안

```text
1. company_profile
2. Paperclip HQ 메인페이지
3. 네이버 검색 API 연동 (v0.7에서 앞당김)
4. opportunity_memos
5. paperclip_decisions
6. HomeFeed title generator
7. Search structure generator
8. products / shopping_connect_links
9. Blog draft generator
10. Compliance Gate
11. Export Bundle
12. sns_variants (Phase 2)
13. performance_logs
14. company_memory
15. Revenue Dashboard (Phase 4)
```

---

## 20. 개발자에게 전달할 핵심 요구사항

```text
- Paperclip은 전체 오케스트레이터다.
- Hermes는 플랫폼 안에서 돌아가는 리서치 부서다.
- 각 채널은 처음부터 독립 Agent로 만들지 말고 Channel Profile로 처리한다.
- 카테고리는 독립 Agent가 아니라 Category Playbook으로 처리한다.
- Agent는 최종 결정을 하지 않는다.
- 모든 최종 게시 판단은 Paperclip과 사용자 승인으로 한다.
- MVP는 자동 발행기가 아니라 수동 게시용 콘텐츠 회사 운영 도구다.
- 네이버 홈피드용 제목과 검색형 제목은 반드시 분리한다.
- 쇼핑커넥트는 직접 실적을 만들기 위한 링크 배치와 CTA를 설계한다.
- Compliance Gate를 통과하지 못하면 Export를 막는다.
- 모든 콘텐츠 성과는 Company Memory에 기록되어 다음 판단에 반영된다.
- (v0.7) AI 모델은 교체 가능한 인터페이스 뒤에 둔다 (모델 미결).
- (v0.7) 모든 입력 UI는 "하루 30분" 예산 기준으로 설계한다.
```

---

## 21. 최종 제품 정의

> **Paperclip Company OS는 내가 혼자 운영하는 AI 미디어커머스 회사를 위한 운영체제다. Hermes는 플랫폼 내부 리서치 부서로 시장·키워드·상품·홈피드 신호를 조사하고, Paperclip은 회사 전체를 감싸는 경영 레이어로 오늘의 기회 선정, 작업 배정, 블로그 제작, 쇼핑커넥트 수익화, 네이버 클립/SNS 재활용, 컴플라이언스 검수, 성과 회고를 지휘한다.**

한 줄 버전:

> **Hermes가 시장을 조사하고, Paperclip이 회사를 운영하고, 부서형 Agent들이 실행하며, 나는 최종 오너로 승인한다.**

실행 버전:

```text
검색에는 정확히 잡히고,
홈판에서는 누르고 싶고,
본문에서는 오래 읽히고,
쇼핑커넥트에서는 특정 상품을 직접 클릭하게 만들고,
SNS에서는 다시 블로그로 돌아오게 만드는 1인 AI 회사 운영 시스템.
```
