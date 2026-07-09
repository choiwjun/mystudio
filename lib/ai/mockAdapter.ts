import type {
  AIAdapter,
  BlogDraftOutput,
  ComplianceInput,
  ComplianceOutput,
  ContentInput,
  DailyBriefingInput,
  DailyBriefingOutput,
  HermesInput,
  OpportunityMemoOutput,
  SearchStructureOutput,
  SnsProfile,
  SnsVariantOutput,
} from "@/lib/ai/adapter";
import {
  parseBlogDraftOutput,
  parseComplianceOutput,
  parseDailyBriefingOutput,
  parseOpportunityMemoOutput,
  parseSearchStructureOutput,
  parseSnsVariantOutput,
} from "@/lib/ai/adapter";

function firstPlaybook(input: ContentInput) {
  return input.generationContext?.categoryPlaybooks[0];
}

function templateLabel(input: ContentInput): string {
  const template = input.generationContext?.promptTemplate;
  return template === undefined ? "기본 프롬프트" : `${template.name} v${template.version}`;
}

function homefeedGuidance(input: ContentInput): string {
  return firstPlaybook(input)?.homefeedToneGuidance ?? "문제를 먼저 짚고 바로 실행 가능한 기준";
}

function searchGuidance(input: ContentInput): string {
  return firstPlaybook(input)?.searchGuidance ?? "체크리스트형 검색 구조";
}

function playbookBodyLine(input: ContentInput): string {
  const playbook = firstPlaybook(input);
  if (playbook === undefined) {
    return "저장 정본은 Markdown이며, 상품 가격과 대가성 문구는 Compliance Gate를 통과해야 Export할 수 있습니다.";
  }

  const winningPattern = playbook.winningPatterns[0] ?? "검증된 구매 기준";
  const commonMistake = playbook.commonMistakes[0] ?? "과장 표현";
  const recommendation = playbook.productRecommendations[0] ?? playbook.category;
  return `${playbook.category} 플레이북을 반영해 ${winningPattern} 흐름을 우선하고, ${commonMistake}를 피하며, ${recommendation} 추천 맥락을 함께 제시합니다.`;
}

export class MockAIAdapter implements AIAdapter {
  readonly metadata = { provider: "mock" as const, model: "deterministic-v1" };
  async generateOpportunityMemo(input: HermesInput): Promise<OpportunityMemoOutput> {
    const firstCategory = input.categories[0] ?? "자취";
    const firstMemoryPattern = input.memoryContext?.patterns[0];
    const memoryReason =
      firstMemoryPattern === undefined
        ? "최근 검색 관심과 계절성 상품 수요가 동시에 확인되었습니다."
        : `Company Memory의 ${firstMemoryPattern.pattern_text} 패턴과 최근 검색 수요가 동시에 확인되었습니다.`;

    return parseOpportunityMemoOutput({
      topic: `${firstCategory} 시즌형 쇼핑 기회`,
      why_now: memoryReason,
      homefeed_angle: "문제 공감형 첫 화면",
      search_angle: "체크리스트형 검색 구조",
      interest_tags: [firstCategory, "계절", "쇼핑"],
      homefeed_score: 72,
      homefeed_reasons: "생활 문제를 빠르게 인지시키기 좋습니다.",
      search_score: 68,
      search_reasons: "검색 의도가 뚜렷한 키워드로 확장 가능합니다.",
      revenue_score: 80,
      revenue_reasons: "관련 소모품과 비교형 CTA를 붙이기 쉽습니다.",
      risk_score: 15,
      score_reasons: "금지 카테고리와 단정 표현 위험이 낮은 주제입니다.",
    });
  }

  async generateBlogDraft(input: ContentInput): Promise<BlogDraftOutput> {
    return parseBlogDraftOutput({
      homefeed_title: [
        `${input.topic} 때문에 놓치는 것`,
        `${input.topic} 체크 전 봐야 할 5가지`,
        `${input.topic} 실패 줄이는 루틴`,
      ],
      search_title: `${input.topic} 선택 기준과 체크리스트`,
      thumbnail_text: ["오늘 바로 점검", "실패 줄이는 기준", "가격 확인 필수"],
      first_screen: `${homefeedGuidance(input)}를 제시합니다. (${templateLabel(input)})`,
      body_markdown: `이 본문은 MockAIAdapter가 생성한 초안입니다. ${playbookBodyLine(input)} 사용 프롬프트: ${templateLabel(input)}.`,
      comparison_table: "| 기준 | 확인 |\n| --- | --- |\n| 가격 | 기준일 필요 |",
      faq: [
        { question: "언제 갱신하나요?", answer: "가격 확인일이 7일을 넘으면 갱신합니다." },
        { question: "자동 게시하나요?", answer: "v0.7은 수동 게시만 지원합니다." },
        { question: "검수는 필수인가요?", answer: "Export 전 서버에서 강제됩니다." },
      ],
      disclosure_text: "이 포스팅은 쇼핑커넥트 활동을 포함할 수 있습니다.",
      price_notice: "가격은 확인일 기준이며 변동될 수 있습니다.",
    });
  }

  async generateSearchStructure(input: ContentInput): Promise<SearchStructureOutput> {
    return parseSearchStructureOutput({
      search_title: `${input.topic} ${searchGuidance(input)}`,
      h2: [searchGuidance(input), "상품 비교", "가격 기준", "자주 묻는 질문"],
      faq: [
        { question: "언제 가격을 갱신하나요?", answer: "7일이 지나면 다시 확인합니다." },
        { question: "자동 게시되나요?", answer: "아니요. v0.7은 수동 게시만 허용합니다." },
        { question: "검수는 필수인가요?", answer: "Export 전에 Compliance Gate를 통과합니다." },
      ],
      comparison_table: "| 기준 | 확인 |\n| --- | --- |\n| 가격 | 기준일 필요 |",
    });
  }

  async generateSNSVariant(input: ContentInput, profile: SnsProfile): Promise<SnsVariantOutput> {
    const sourceExcerpt =
      input.sourceDraftMarkdown === undefined || input.sourceDraftMarkdown.trim() === ""
        ? "블로그 본문"
        : input.sourceDraftMarkdown.replace(/\s+/g, " ").trim().slice(0, 80);
    return parseSnsVariantOutput({
      platform: profile.platform,
      format: profile.format,
      hook: `원룸 ${input.topic}, 이 기준 놓치면 돈만 쓰기 쉽습니다`,
      body: `문제: ${sourceExcerpt}\n체크: 가격 기준일, 사용 상황, 제휴 고지를 함께 확인하세요.\n선택: 필요한 조건이 맞을 때만 링크를 눌러 비교합니다.`,
      cta: "블로그 본문에서 체크리스트와 쇼핑커넥트 고지를 함께 확인하세요.",
      hashtags: ["자취", "생활템", "쇼핑커넥트", "체크리스트"],
      score: 82,
    });
  }

  async scoreHomefeed(_draft: BlogDraftOutput): Promise<number> {
    return 72;
  }

  async checkCompliance(input: ComplianceInput): Promise<ComplianceOutput> {
    const issues = [];
    const activePolicyCodes = new Set(input.policyRules?.map((rule) => rule.rule_code) ?? []);

    if (
      input.hasShoppingConnectLinks &&
      !input.bodyMarkdown.includes("쇼핑커넥트") &&
      (activePolicyCodes.size === 0 ||
        activePolicyCodes.has("shopping_connect_disclosure_required"))
    ) {
      issues.push({
        type: "disclosure_missing",
        field: "body_markdown",
        severity: "high" as const,
        message: "쇼핑커넥트 링크가 있지만 대가성 문구가 없습니다.",
        suggested_fix: "본문 상단에 대가성 문구를 추가하세요.",
      });
    }

    if (
      input.hasPriceMentions &&
      !/확인일 기준|변동될 수|변동 가능|가격 변동/.test(input.bodyMarkdown) &&
      (activePolicyCodes.size === 0 || activePolicyCodes.has("price_checked_at_required"))
    ) {
      issues.push({
        type: "price_notice_missing",
        field: "body_markdown",
        severity: "high" as const,
        message: "가격 언급이 있지만 가격 기준일 문구가 없습니다.",
        suggested_fix: "가격 기준일과 변동 가능 문구를 추가하세요.",
      });
    }

    return parseComplianceOutput({
      pass: issues.length === 0,
      risk_level: issues.length === 0 ? "low" : "high",
      export_allowed: issues.length === 0,
      issues,
    });
  }

  async generateDailyBriefing(input: DailyBriefingInput): Promise<DailyBriefingOutput> {
    const categories = input.companyProfile.primaryCategories.slice(0, 3);
    const focusCategories = categories.length === 0 ? ["자취"] : categories;

    return parseDailyBriefingOutput({
      goals: "오늘 콘텐츠 1개를 승인 가능한 상태까지 진행합니다.",
      focus_categories: focusCategories,
      priority_angle: "홈피드 공감형 우선순위",
      strategy_note: "회사 프로필과 최신 기회 메모를 기준으로 실행 가능한 콘텐츠를 우선합니다.",
    });
  }
}
