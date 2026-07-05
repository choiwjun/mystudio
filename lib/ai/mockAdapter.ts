import type {
  AIAdapter,
  BlogDraftOutput,
  ComplianceInput,
  ComplianceOutput,
  ContentInput,
  HermesInput,
  OpportunityMemoOutput,
  SearchStructureOutput,
  SnsProfile,
  SnsVariantOutput,
} from "@/lib/ai/adapter";
import {
  parseBlogDraftOutput,
  parseComplianceOutput,
  parseOpportunityMemoOutput,
  parseSearchStructureOutput,
  parseSnsVariantOutput,
} from "@/lib/ai/adapter";

export class MockAIAdapter implements AIAdapter {
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
      first_screen: "문제를 먼저 짚고 바로 실행 가능한 기준을 제시합니다.",
      body_markdown:
        "이 본문은 MockAIAdapter가 생성한 초안입니다. 실제 모델은 AIAdapter 뒤에서 교체되며, 저장 정본은 Markdown입니다. 상품 가격과 대가성 문구는 Compliance Gate를 통과해야 Export할 수 있습니다.",
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
      search_title: `${input.topic} 검색형 체크리스트`,
      h2: ["문제 확인", "상품 비교", "가격 기준", "자주 묻는 질문"],
      faq: [
        { question: "언제 가격을 갱신하나요?", answer: "7일이 지나면 다시 확인합니다." },
        { question: "자동 게시되나요?", answer: "아니요. v0.7은 수동 게시만 허용합니다." },
        { question: "검수는 필수인가요?", answer: "Export 전에 Compliance Gate를 통과합니다." },
      ],
      comparison_table: "| 기준 | 확인 |\n| --- | --- |\n| 가격 | 기준일 필요 |",
    });
  }

  async generateSNSVariant(input: ContentInput, profile: SnsProfile): Promise<SnsVariantOutput> {
    return parseSnsVariantOutput({
      platform: profile.platform,
      format: profile.format,
      hook: `${input.topic}를 오늘 확인해야 하는 이유`,
      body: `${input.topic} 핵심만 재가공한 소셜 버전입니다.`,
      cta: "블로그 본문에서 체크리스트를 확인하세요.",
      hashtags: ["자취", "쇼핑", "체크리스트"],
      score: 70,
    });
  }

  async scoreHomefeed(_draft: BlogDraftOutput): Promise<number> {
    return 72;
  }

  async checkCompliance(input: ComplianceInput): Promise<ComplianceOutput> {
    const issues = [];
    if (input.hasShoppingConnectLinks && !input.bodyMarkdown.includes("쇼핑커넥트")) {
      issues.push({
        type: "disclosure_missing",
        field: "body_markdown",
        severity: "high" as const,
        message: "쇼핑커넥트 링크가 있지만 대가성 문구가 없습니다.",
        suggested_fix: "본문 상단에 대가성 문구를 추가하세요.",
      });
    }

    return parseComplianceOutput({
      pass: issues.length === 0,
      risk_level: issues.length === 0 ? "low" : "high",
      export_allowed: issues.length === 0,
      issues,
    });
  }
}
