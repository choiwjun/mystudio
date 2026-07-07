# 04-database-design.md: 데이터베이스 설계

> Paperclip Company OS v0.7
> Prisma ORM, PostgreSQL (Supabase)
> 기준일: 2026-07-02

---

## 테이블 목록 (28개)

**핵심 그룹**:
- Platform: workspaces (v2 전방 호환 — 2026-07-04 council §4-3 종결 결정)
- Company Setup: company_profile, hq_briefing
- Hermes: sources, raw_items, opportunity_memos
- Paperclip: paperclip_decisions
- Content: topics, keyword_clusters, content_packages, drafts, sns_variants, title_candidates, exports
- ShoppingConnect: products, shopping_connect_links
- Compliance: compliance_checks, compliance_issues, policy_rules, status_transitions
- Analytics: performance_logs, revenue_logs, cost_logs, error_logs
- Memory: company_memory, prompt_templates
- Admin: agent_runs, category_playbooks

---

## Prisma 스키마 (28개 모델 + Enum)

```prisma
// ============================================
// Enums (B1: 상태 머신 정본화)
// ============================================
// @SPEC docs/planning/loop/revision-request-02.md#B1
// @NOTE 최종 상태 목록: 현 specs/shared/types.yaml PackageStatus enum을 정본으로 함
// @NOTE 승인 워크플로 확정 (2026-07-02, council-report §4-1): 승인 상태 정식 채택 —
//       compliance_checked → owner_approval_required → approved → exported.
//       승인/반려 기록은 StatusTransition(actor='owner')이 감사 원장 (별도 승인 테이블 불필요).
//       운영 상태 축소는 UI 레벨 그룹화(칸반 매핑)로 처리 — enum은 §10 정본 유지.
//       상태 추가/제거는 types.yaml 동기화 필수

enum PackageStatus {
  // Main flow (00-source-plan §10)
  opportunity_found
  paperclip_review
  selected
  assigned
  brief_created
  homefeed_packaged
  search_structured
  revenue_links_attached
  blog_draft_generated
  sns_repurposed
  compliance_checked
  owner_approval_required
  approved
  exported
  published_manually
  performance_recorded
  memory_updated
  archived
  // Exception states
  rejected
  duplicate
  stale
  needs_research
  needs_link_refresh
  compliance_failed
  price_outdated
  policy_risk
  low_revenue_fit
  low_homefeed_fit
}

// ============================================
// 0. Platform (v2 전방 호환)
// ============================================
// @DECISION 2026-07-04: council §4-3(멀티테넌시) 종결 — Won't도 전면 삽입도 아닌 중간해.
//   workspaces 테이블 + company_profile 연결만 v0.7에 선삽입한다.
//   v0.7 런타임은 마이그레이션 시 default 워크스페이스 1개를 시드하고 항상 단일 워크스페이스로 동작.
//   나머지 테이블은 company_profile/상위 FK 경유로 격리되므로 workspace_id를 추가하지 않는다.
//   (v2 Studio에서 루트 엔티티 확장 — docs/planning/vision/vocabulary-map.md 참조)

model Workspace {
  id                    String   @id @default(cuid())
  name                  String   @default("default")
  createdAt             DateTime @default(now()) @map("created_at")

  companyProfiles       CompanyProfile[]

  @@map("workspaces")
}

// ============================================
// 1. Company Setup
// ============================================

model CompanyProfile {
  id                    String   @id @default(cuid())
  workspaceId           String   @map("workspace_id") // v2 전방 호환 — v0.7은 default 워크스페이스 고정
  workspace             Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  companyName           String   @default("My Company") @map("company_name")
  primaryCategories     String[] @map("primary_categories") // ["자취", "장마", "청소"]
  blockedCategories     String[] @map("blocked_categories") // ["건강", "의료", "투자"]
  toneRules             String   @map("tone_rules")         // "친근하지만 신뢰감있는"
  contentPrinciples     String   @map("content_principles") // "문제 중심, 직접 체험 기반"
  revenueGoalMonthly    Int      @default(500000) @map("revenue_goal_monthly") // ₩
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@map("company_profile")
}

model HqBriefing {
  id                    String   @id @default(cuid())
  date                  DateTime @default(now())
  goals                 String   // 오늘의 경영 목표
  focusCategories       String[] @map("focus_categories") // ["자취", "장마"]
  priorityAngle         String   @map("priority_angle")   // 우선 추진 각도
  strategyNote          String?  @map("strategy_note")
  status                String   // "draft" / "confirmed" / "completed"
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@map("hq_briefing")
  @@index([date])
}

// ============================================
// 2. Hermes Research
// ============================================

model Source {
  id                    String   @id @default(cuid())
  sourceType            String   @map("source_type")    // "naver_blog_search" / "naver_shopping_search"
  apiEndpoint           String   @map("api_endpoint")
  lastScannedAt         DateTime? @map("last_scanned_at")
  nextScheduledAt       DateTime @default(now()) @map("next_scheduled_at")
  status                String   @default("active") // "active" / "disabled"
  createdAt             DateTime @default(now()) @map("created_at")

  rawItems              RawItem[]

  @@map("sources")
}

model RawItem {
  id                    String   @id @default(cuid())
  sourceId              String @map("source_id")
  source                Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  itemType              String   @map("item_type")      // "blog_post" / "shopping_product"
  title                 String
  url                   String
  content               String?  // 블로그 본문 일부 / 상품 설명
  metadata              Json?    // 평점, 리뷰 수 등
  collectedAt           DateTime @default(now()) @map("collected_at")
  expiresAt             DateTime @db.Timestamp @map("expires_at") // 7일 후 자동 삭제

  @@map("raw_items")
  @@index([sourceId, collectedAt])
}

model OpportunityMemo {
  id                    String   @id @default(cuid())
  topic                 String
  whyNow                String   @map("why_now")  // "장마 시즌 + 자취 관심사 결합"
  homefeedAngle         String   @map("homefeed_angle")  // 피드용 각도
  searchAngle           String   @map("search_angle")    // 검색용 각도
  interestTags          String[] @map("interest_tags")   // ["자취", "원룸", "장마", ...]
  homefeedScore         Int      @map("homefeed_score")  // 0~100
  homefeedReasons       String?  @map("homefeed_reasons") // 근거 문장
  searchScore           Int      @map("search_score")    // 0~100
  searchReasons         String?  @map("search_reasons")
  revenueScore          Int      @map("revenue_score")   // 0~100
  revenueReasons        String?  @map("revenue_reasons")
  riskScore             Int      @map("risk_score")      // 0~100 (낮을수록 좋음)
  scoreReasons          String?  @map("score_reasons")   // 4축 근거 종합
  recommendedPackages   String[] @map("recommended_packages") // ["naver_blog", "naver_clip", ...]
  status                String   @default("opportunity_found")
  createdAt             DateTime @default(now()) @map("created_at")

  paperclipDecisions    PaperclipDecision[]
  keywordClusters       KeywordCluster[]

  @@map("opportunity_memos")
  @@index([status, createdAt])
}

// ============================================
// 3. Paperclip (의사결정)
// ============================================

model PaperclipDecision {
  id                    String   @id @default(cuid())
  opportunityMemoId     String? @map("opportunity_memo_id")
  opportunityMemo       OpportunityMemo? @relation(fields: [opportunityMemoId], references: [id], onDelete: SetNull)
  decision              String   // "selected" / "on_hold" / "rejected"
  reason                Json?    @map("reason_json")  // ["자취 적합", "쇼핑 가능", ...]
  assignedProfiles      String[] @map("assigned_profiles") // ["NaverBlogProfile", "NaverClipProfile", ...]
  priority              Int      @default(5) // 1~10
  requiresOwnerApproval Boolean  @default(true) @map("requires_owner_approval")
  createdAt             DateTime @default(now()) @map("created_at")

  topics                Topic[]
  contentPackages       ContentPackage[]

  @@map("paperclip_decisions")
  @@index([decision, createdAt])
}

// ============================================
// 4. Content Production
// ============================================

model Topic {
  id                    String   @id @default(cuid())
  paperclipDecisionId   String @map("paperclip_decision_id")
  paperclipDecision     PaperclipDecision @relation(fields: [paperclipDecisionId], references: [id], onDelete: Cascade)
  title                 String
  description           String?
  selectedAt            DateTime @default(now()) @map("selected_at")

  contentPackage        ContentPackage?

  @@map("topics")
  @@index([selectedAt])
}

model KeywordCluster {
  id                    String   @id @default(cuid())
  opportunityMemoId     String   @map("opportunity_memo_id")  // resources.yaml 계약: memo에 내장 반환
  opportunityMemo       OpportunityMemo @relation(fields: [opportunityMemoId], references: [id], onDelete: Cascade)
  primaryKeyword        String   @map("primary_keyword")   // "장마철 자취방 습기"
  relatedKeywords       String[] @map("related_keywords")  // ["장마철 자취방", "습기 제거", ...]
  searchVolume          Int?     @map("search_volume")     // 월 검색량
  competitionScore      Int?     @map("competition_score") // 0~100 경쟁도

  @@map("keyword_clusters")
  @@index([opportunityMemoId])
}

model ContentPackage {
  id                    String   @id @default(cuid())
  // resources.yaml 계약의 opportunity_memo_id는 직접 컬럼이 아니라 paperclipDecision.opportunityMemoId 조인 파생으로 응답에 포함
  paperclipDecisionId   String @map("paperclip_decision_id")
  paperclipDecision     PaperclipDecision @relation(fields: [paperclipDecisionId], references: [id], onDelete: Cascade)
  topicId               String   @unique @map("topic_id")
  topic                 Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  
  // 4축 점수 (resources.yaml 기준)
  homefeedScore         Int?     @map("homefeed_score")  // 0~100
  searchScore           Int?     @map("search_score")    // 0~100
  revenueScore          Int?     @map("revenue_score")   // 0~100
  riskScore             Int?     @map("risk_score")      // 0~100 (낮을수록 좋음)
  publishReadiness      String   @default("not_ready") @map("publish_readiness") // "ready" / "issues" / "not_ready"
  progress              Float?   // 0.0~1.0 진행률
  publishedAt           DateTime? @map("published_at")
  status                PackageStatus @default(assigned) // @TASK B1: Prisma enum 정본화. 모든 상태 변경은 단일 전이 서비스 경유 (직접 UPDATE 금지)
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  statusTransitions     StatusTransition[] // @TASK B1: 상태 전이 이력
  drafts                Draft[]
  snsVariants           SNSVariant[]
  titleCandidates       TitleCandidate[] @relation("TitleCandidates")
  exports               Export[] @relation("Exports")
  complianceChecks      ComplianceCheck[]
  performanceLogs       PerformanceLog[]
  shoppingConnectLinks  ShoppingConnectLink[]

  @@map("content_packages")
  @@index([status, updatedAt])
}

model Draft {
  id                    String   @id @default(cuid())
  contentPackageId      String @map("content_package_id")
  contentPackage        ContentPackage @relation(fields: [contentPackageId], references: [id], onDelete: Cascade)
  
  channel               String   // "naver_blog" (Phase 1) / "naver_clip" / "instagram" / etc
  
  // HomeFeed Desk
  homefeedTitle         String[]  @map("homefeed_title")  // 최대 10개
  searchTitle           String?   @map("search_title")
  thumbnailText         String[]  @map("thumbnail_text")  // 최대 5개
  firstScreen           String?   @map("first_screen")    // 5초 구조 설명
  
  // Blog content
  bodyMarkdown          String?   @map("body_markdown")   // 최종 본문 (정본, 저장함)
  // @TASK B2: Export 경계 생성, 저장 안 함. bodyHtml 컬럼 폐지 (HTML은 Export 시점에만 생성)
  comparisonTable       String?   @map("comparison_table") // 비교표 콘텐츠
  faq                   Json?     // @TASK B2: FAQ 섹션 JSON 구조: [{ question: string, answer: string }]
  disclosureText        String?   @map("disclosure_text")  // 쇼핑커넥트 대가성 문구
  priceNotice           String?   @map("price_notice")     // 가격 기준일 표기
  
  // @TASK B3: [되돌림] 버튼 지원 (풀 리비전 테이블 금지)
  originalBody          String?   @map("original_body")    // bodyMarkdown AI 생성 직후 스냅샷 (되돌림 용도)
  
  // Meta
  status                String   @default("draft")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  complianceChecks      ComplianceCheck[]

  @@map("drafts")
  @@index([contentPackageId, channel])
}

model SNSVariant {
  id                    String   @id @default(cuid())
  contentPackageId      String @map("content_package_id")
  contentPackage        ContentPackage @relation(fields: [contentPackageId], references: [id], onDelete: Cascade)
  
  platform              String   // "instagram" / "threads" / "x"
  format                String   // "carousel" / "post" / "thread"
  hook                  String?  // 후킹 문장
  body                  String   // 본문
  cta                   String?  // Call-to-action
  hashtags              String[]  // ["자취", "장마"]
  
  score                 Int?     // 플랫폼별 기대 점수
  createdAt             DateTime @default(now()) @map("created_at")

  @@map("sns_variants")
  @@index([contentPackageId, platform])
}

model TitleCandidate {
  id                    String   @id @default(cuid())
  contentPackageId      String @map("content_package_id")
  contentPackage        ContentPackage @relation("TitleCandidates", fields: [contentPackageId], references: [id], onDelete: Cascade)
  
  kind                  String   // "homefeed_title" / "search_title" / "thumbnail_text"
  text                  String   // 후보 텍스트
  hookType              String?  @map("hook_type")  // "problem_empathy" / "mistake_pointing" / etc
  selected              Boolean  @default(false)
  createdAt             DateTime @default(now()) @map("created_at")

  @@map("title_candidates")
  @@index([contentPackageId, kind])
}

model Export {
  id                    String   @id @default(cuid())
  contentPackageId      String @map("content_package_id")
  contentPackage        ContentPackage @relation("Exports", fields: [contentPackageId], references: [id], onDelete: Cascade)
  
  format                String   // "markdown" / "html" / "json"
  content               String   // 실제 내보낸 콘텐츠
  createdAt             DateTime @default(now()) @map("created_at")

  @@map("exports")
  @@index([contentPackageId, createdAt])
}

// ============================================
// 5. ShoppingConnect
// ============================================

model Product {
  id                    String   @id @default(cuid())
  productName           String   @map("product_name")
  productUrl            String   @map("product_url")
  source                String   // "naver_shopping" / "naver_blog" / "manual"
  price                 Int?
  priceCheckedAt        DateTime? @map("price_checked_at") // stale 기준: 7일 초과 시 갱신 필요
  imageUrl              String?   @map("image_url")
  category              String?  // "제습제" / "제습기"
  memo                  String?  // 사용자 메모
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  shoppingConnectLinks  ShoppingConnectLink[]
  revenueLogs           RevenueLog[] @relation("ProductRevenue")

  @@map("products")
  @@index([createdAt])
}

model ShoppingConnectLink {
  id                    String   @id @default(cuid())
  productId             String @map("product_id")
  product               Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  contentPackageId      String? @map("content_package_id")
  contentPackage        ContentPackage? @relation(fields: [contentPackageId], references: [id], onDelete: SetNull)
  
  shoppingConnectUrl    String   @map("shopping_connect_url")  // 쇼핑커넥트 생성 링크
  commissionRate        Float    @map("commission_rate")       // 2.0 (%)
  bonusCommission       Float?   @map("bonus_commission")      // 추가 보너스
  linkCheckedAt         DateTime? @map("link_checked_at")      // stale 기준: 7일 초과 시 갱신 필요
  isActive              Boolean  @default(true) @map("is_active")
  notes                 String?
  
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@map("shopping_connect_links")
  @@index([productId, contentPackageId])
}

// ============================================
// 6. Compliance
// ============================================

model ComplianceCheck {
  id                    String   @id @default(cuid())
  contentPackageId      String @map("content_package_id")
  contentPackage        ContentPackage @relation(fields: [contentPackageId], references: [id], onDelete: Cascade)
  draftId               String? @map("draft_id")
  draft                 Draft?   @relation(fields: [draftId], references: [id], onDelete: SetNull)
  
  riskLevel             String   @map("risk_level")  // "low" / "medium" / "high"
  pass                  Boolean  @default(false)
  exportAllowed         Boolean  @default(false) @map("export_allowed")
  checkedAt             DateTime @default(now()) @map("checked_at")

  complianceIssues      ComplianceIssue[] // API 응답에서는 issues[] 중첩 배열로 직렬화 (resources.yaml 계약 — DB는 정규화 유지)

  @@map("compliance_checks")
  @@index([contentPackageId, pass])
}

model ComplianceIssue {
  id                    String   @id @default(cuid())
  complianceCheckId     String @map("compliance_check_id")
  complianceCheck       ComplianceCheck @relation(fields: [complianceCheckId], references: [id], onDelete: Cascade)
  
  issueType             String   @map("issue_type")       // "price_checked_at_missing" / "disclosure_missing" / etc
  severity              String   // "low" / "medium" / "high"
  message               String
  suggestedFix          String?  @map("suggested_fix")
  
  // @TASK B4: [무시] 감사 이력 (차등 규칙: low=원클릭+자동기록 / medium=사유 필수 / high=dismiss 불가)
  dismissedAt           DateTime? @map("dismissed_at")
  dismissedBy           String?   @map("dismissed_by")    // 사용자 ID
  dismissReason         String?   @map("dismiss_reason")  // medium/high 필수, low는 선택
  
  @@map("compliance_issues")
}

model StatusTransition {
  id                    String   @id @default(cuid())
  contentPackageId      String   @map("content_package_id")
  contentPackage        ContentPackage @relation(fields: [contentPackageId], references: [id], onDelete: Cascade)
  
  fromStatus            PackageStatus @map("from_status")
  toStatus              PackageStatus @map("to_status")
  actor                 String   // 상태 변경 주체 (사용자 ID 또는 "system")
  reason                String?  // 상태 변경 사유 (선택)
  createdAt             DateTime @default(now()) @map("created_at")
  
  // @TASK B1: 모든 상태 변경은 단일 전이 서비스 경유 (직접 UPDATE 금지)
  // 이 테이블은 모든 상태 전이를 기록하여 감시 추적 및 상태 머신 검증 이력 제공
  
  @@map("status_transitions")
  @@index([contentPackageId, createdAt])
}

// ============================================
// 7. Analytics
// ============================================

model PerformanceLog {
  id                    String   @id @default(cuid())
  contentPackageId      String @map("content_package_id")
  contentPackage        ContentPackage @relation(fields: [contentPackageId], references: [id], onDelete: Cascade)
  
  platform              String   // "naver_blog" / "naver_clip"
  postUrl               String   @map("post_url")
  hookType              String?  @map("hook_type")  // "problem_empathy" / "mistake_pointing" / etc
  
  views                 Int      @default(0)
  clicks                Int?
  directRevenue         Int?     @map("direct_revenue")  // ₩
  recordedAt            DateTime @default(now()) @map("recorded_at")

  @@map("performance_logs")
  @@index([contentPackageId, platform])
}

model RevenueLog {
  id                    String   @id @default(cuid())
  productId             String @map("product_id")
  product               Product  @relation("ProductRevenue", fields: [productId], references: [id], onDelete: Cascade)
  
  amount                Int      // ₩
  revenueType           String   @map("revenue_type")  // "direct" / "indirect"
  referrerUrl           String?  @map("referrer_url")
  orderedAt             DateTime @map("ordered_at")
  createdAt             DateTime @default(now()) @map("created_at")

  @@map("revenue_logs")
  @@index([productId, orderedAt])
}

model CostLog {
  id                    String   @id @default(cuid())
  model                 String   // "claude" / "gpt-4" / "gpt-3.5"
  task                  String   // "generate_memo" / "generate_blog" / etc
  pipelineStep          String   @map("pipeline_step")   // "hermes" / "content" / "compliance" / "export" (02-trd §5 A2)
  inputTokens           Int      @map("input_tokens")
  outputTokens          Int      @map("output_tokens")
  costUsd               Float    @map("cost_usd")
  blockedByCap          Boolean  @default(false) @map("blocked_by_cap") // 서킷브레이커에 의해 차단된 호출 기록 (02-trd §5 A2)
  createdAt             DateTime @default(now()) @map("created_at")

  @@map("cost_logs")
  @@index([model, createdAt])
  @@index([pipelineStep, createdAt])
}

model ErrorLog {
  id                    String   @id @default(cuid())
  errorCode             String   @map("error_code")
  message               String
  stackTrace            String?  @map("stack_trace")
  // @TASK B5: context에 request_body 원문 저장 금지. 민감 필드 거부목록(password, token, secret, authorization, apiKey) 마스킹 후 저장
  context               Json?    // { user_id, api_path, request_id, request_body_masked: {...} }
  severity              String   @default("low") // "low" / "medium" / "high"
  createdAt             DateTime @default(now()) @map("created_at")
  resolvedAt            DateTime? @map("resolved_at")
  resolutionNote        String?  @map("resolution_note")

  @@map("error_logs")
  @@index([severity, createdAt])
}

// ============================================
// 8. Company Memory & Admin
// ============================================

model CompanyMemory {
  id                    String   @id @default(cuid())
  // 어휘 정본: 02-trd §2.6 A9 (council 결정). user_id는 §4-3 멀티테넌시 결정 대기로 미포함
  patternType           String   @map("pattern_type")   // enum: "homefeed_hook" / "search_keyword" / "product_angle" / "pricing_strategy" / "seasonal_theme"
  category              String?  // "자취" / "장마"
  // @TASK B6: 구조화 필드+enum 태그로 분해 (자유 텍스트 단일 필드 금지, prompt injection 면적 축소)
  patternText           String   @map("pattern_text")   // AI가 추출한 핵심 문구 (구조화됨)
  tags                  String[] // enum 태그 배열 (예: ["문제공감형", "모바일"]). 자유 텍스트 금지
  resultSummary         String   @map("result_summary")  // "자취 카테고리에서 문제공감형 제목은 평균 270 조회"
  score                 Float    // 신뢰도 0.0~1.0
  sampleCount           Int      @map("sample_count")    // N<5이면 추천 억제, "배우는 중" 정직 표시
  avgViews              Float?   @map("avg_views")       // A9 통계
  avgClicks             Float?   @map("avg_clicks")      // A9 통계
  avgRevenueUsd         Float?   @map("avg_revenue_usd") // A9 통계
  createdPatternIds     String[] @map("created_pattern_ids")        // 이 패턴이 생성한 content_package IDs (A9 패턴 가시성)
  usedInRecommendations Int      @default(0) @map("used_in_recommendations") // 추천에 쓰인 횟수 (A9)
  evidenceJson          Json?    @map("evidence_json")  // 부가 증거 { count_samples: 5, ... }
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@map("company_memory")
  @@index([patternType, category])
}

model PromptTemplate {
  id                    String   @id @default(cuid())
  name                  String   // "opportunity_memo_generation" / "blog_draft_generation"
  engine                String   // "hermes" / "content" / "compliance"
  version               Int      @default(1)
  template              String   // Nunjucks 템플릿
  variables             Json     // { "homefeed_angle": "string", ... }
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@map("prompt_templates")
}

model AgentRun {
  id                    String   @id @default(cuid())
  agentName             String   @map("agent_name")    // "Hermes" / "HomeFeed Desk" / etc
  taskType              String   @map("task_type")
  inputJson             Json?    @map("input_json")
  outputJson            Json?    @map("output_json")
  status                String   // "running" / "success" / "failed"
  errorMessage          String?  @map("error_message")
  durationMs            Int?     @map("duration_ms")
  createdAt             DateTime @default(now()) @map("created_at")

  @@map("agent_runs")
  @@index([agentName, status, createdAt])
}

model PolicyRule {
  id                    String   @id @default(cuid())
  ruleType              String   @map("rule_type")      // "compliance" / "content" / "revenue"
  ruleCode              String   @map("rule_code")      // "no_100_percent_claims"
  description           String
  isActive              Boolean  @default(true) @map("is_active")
  
  @@map("policy_rules")
}

model CategoryPlaybook {
  id                    String   @id @default(cuid())
  category              String   // "자취" / "장마" / "청소"
  homefeedToneGuidance  String?  @map("homefeed_tone_guidance")    // "젊은 목소리, 공감 중심"
  searchGuidance        String?  @map("search_guidance")           // "B2C, 비교표 필수"
  productRecommendations String[]  @map("product_recommendations") // ["세제", "향수"]
  commonMistakes        String[]  @map("common_mistakes")          // "과장 표현 금지"
  winningPatterns       String[]  @map("winning_patterns")         // "홈판에서는 문제공감형이 35% 더 잘 먹힘"
  
  @@map("category_playbooks")
}
```

**마이그레이션 예시**:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## 주요 관계도

```
CompanyProfile (1)
HqBriefing (1:N by date)
    ↓
OpportunityMemo (1) ← PaperclipDecision (N)
    ├─ KeywordCluster (N)   # memo에 내장 반환 (resources.yaml 계약)
    ↓
Topic (1)
    ├─ Product (N)
    │   └─ ShoppingConnectLink (N)
    └─ ContentPackage (1)
        ├─ StatusTransition (N)  # @TASK B1: 상태 전이 이력 (모든 전이 기록)
        ├─ Draft (N, channel별)
        │   └─ ComplianceCheck (N)
        │       └─ ComplianceIssue (N, [무시] 감시 이력)
        ├─ TitleCandidate (N, kind별)
        ├─ Export (N, format별)
        ├─ SNSVariant (N, 플랫폼별)
        ├─ ShoppingConnectLink (N)
        └─ PerformanceLog (N, 게시 후)
```

---

## 인덱스 전략

```sql
-- 빠른 조회
CREATE INDEX idx_opportunity_memos_status_created ON opportunity_memos(status, created_at DESC);
CREATE INDEX idx_content_packages_status_updated ON content_packages(status, updated_at DESC);
CREATE INDEX idx_drafts_package_channel ON drafts(content_package_id, channel);
CREATE INDEX idx_compliance_checks_package_pass ON compliance_checks(content_package_id, pass);

-- 성과 분석
CREATE INDEX idx_performance_logs_package_platform ON performance_logs(content_package_id, platform);
CREATE INDEX idx_revenue_logs_product_date ON revenue_logs(product_id, ordered_at DESC);

-- 메모리 및 학습
CREATE INDEX idx_company_memory_type_category ON company_memory(pattern_type, category);

-- 비용 추적
CREATE INDEX idx_cost_logs_model_created ON cost_logs(model, created_at DESC);
CREATE INDEX idx_error_logs_severity_created ON error_logs(severity, created_at DESC);
```

---

## 데이터 보존 정책

| 테이블 | 보존 기간 | 자동 삭제 |
|--------|---------|---------|
| `raw_items` | 7일 | O (expiresAt) |
| `agent_runs` | 30일 | O (cron job) |
| `error_logs` (low/medium) | 90일 | O (cron job) |
| `error_logs` (high) | 180일 | O (cron job) |
| `cost_logs` | 12개월 | O (cron job) |
| `status_transitions` | 무제한 | X (감사 추적, @TASK B3 동반) |
| `compliance_issues` | 무제한 | X (감사 기록, @TASK B4 [무시] 이력 동반) |
| `performance_logs` | 무제한 | X (분석 용도) |
| `company_memory` | 무제한 | X (학습 용도) |
| `opportunity_memos` | 무제한 | X (히스토리 용도) |

**@TASK B7 정정**: 보존 정책 표 명확화 — 감시·감사 관련 테이블(status_transitions, compliance_issues)은 무제한 보존으로 통일. 운영 로그(agent_runs, error_logs)는 위험도 차등화(high 180일).

---

## 마이그레이션 체크리스트

- [ ] PostgreSQL (Supabase) 생성
- [ ] Prisma 초기 스키마 작성 및 마이그레이션
- [ ] PackageStatus enum 동기화 (specs/shared/types.yaml와 정본 유지)
- [ ] 상태 전이 서비스 구현 (단일 진입점, StatusTransition 로깅)
- [ ] 시드 데이터: CompanyProfile 기본값 / PolicyRules / CategoryPlaybooks
- [ ] 인덱스 생성 (status_transitions 인덱스 포함)
- [ ] 백업 정책 설정 (감사 테이블 우선)
- [ ] 읽기 전용 복제본 (분석용) 생성

---

## Loop Metadata

- **Upstream documents referenced**: 00-source-plan.md (9장 데이터베이스 설계, 10장 상태값), 02-trd.md (시스템 구조), 03-user-flow.md (상태값 전이), specs/shared/types.yaml (PackageStatus 정본)
- **Downstream documents affected**: 07-coding-convention.md (쿼리 및 마이그레이션 규칙), revision-request-02.md (B1~B7 반영 사항)
- **Council 미합의 쟁점 (council-report §4)**: 
  - §4-1: ✅ 확정 (2026-07-02) — 승인 상태 정식 채택, StatusTransition이 승인 감사 원장
  - §4-2: ✅ 확정 (2026-07-02) — 경량 중간해 (maxDuration + 클라이언트 단계별 순차 호출), 마이그레이션 전략에 미영향
  - §4-3: 멀티테넌시 (owner_id 컬럼 지금 추가 vs Won't 확정) → 현재 단일 사용자 구조 유지
  - §4-6: ✅ 확정 (2026-07-05) — P2-S1 URL 붙여넣기 존속, SSRF 방어 + 수동 입력 폴백 필수
- **Open questions**: 멀티 테넌트 전환 시 마이그레이션 경로, 벡터 임베딩 필드 추가 시기, 데이터 익명화 정책, Company Memory 알고리즘 완정
- **Assumptions**: Supabase PostgreSQL의 안정성, Prisma 마이그레이션 자동화, 월 데이터 증가량 < 10GB, 상태 머신 단일 정본 준수
