import { describe, expect, it, vi } from "vitest";
import { AIOutputValidationError, type BlogDraftOutput } from "@/lib/ai/adapter";
import { OllamaAdapter } from "@/lib/ai/ollamaAdapter";
import { AIProviderResponseError, ClaudeAIAdapter, OpenAIAdapter } from "@/lib/ai/providerAdapters";
import { AIAdapterConfigurationError, createRuntimeAIAdapter } from "@/lib/ai/runtime";

const opportunityMemo = {
  topic: "여름 자취 냉방 준비",
  why_now: "장마와 폭염이 겹치며 냉방 소모품 수요가 빠르게 늘고 있습니다.",
  homefeed_angle: "폭염 전 체크리스트",
  search_angle: "냉방 소모품 비교 검색",
  interest_tags: ["자취", "냉방", "여름"],
  homefeed_score: 78,
  homefeed_reasons: "계절 문제를 즉시 떠올리게 합니다.",
  search_score: 74,
  search_reasons: "명확한 구매 전 검색 의도가 있습니다.",
  revenue_score: 82,
  revenue_reasons: "연관 상품 비교와 링크 전환에 적합합니다.",
  risk_score: 12,
  score_reasons: "의료나 과장 효능 표현 없이 생활 정보로 다룰 수 있습니다.",
};

const blogDraft: BlogDraftOutput = {
  homefeed_title: ["냉방 준비 놓친 것", "폭염 전 확인할 5가지", "자취방 냉방 루틴"],
  search_title: "자취방 냉방 준비 체크리스트",
  thumbnail_text: ["폭염 전 점검", "가격 확인", "실패 줄이기"],
  first_screen: "폭염이 오기 전 자취방 냉방 준비에서 놓치기 쉬운 기준을 정리합니다.",
  body_markdown:
    "자취방 냉방 준비는 필터, 서큘레이터, 차광, 전기요금 기준을 함께 확인해야 합니다. 먼저 현재 방 구조와 창 방향을 살피고, 이미 가진 제품으로 해결 가능한지 확인합니다. 이후 필요한 소모품과 보조 제품을 가격 확인일 기준으로 비교하면 불필요한 구매를 줄일 수 있습니다.",
  comparison_table: "| 기준 | 확인 |\n| --- | --- |\n| 가격 | 기준일 필요 |",
  faq: [
    { question: "언제 점검하나요?", answer: "폭염 예보 전 미리 점검합니다." },
    { question: "가격은 고정인가요?", answer: "가격은 변동될 수 있어 확인일을 남깁니다." },
    { question: "자동 게시되나요?", answer: "아니요. 게시 전 검수가 필요합니다." },
  ],
  disclosure_text: "이 포스팅은 쇼핑커넥트 활동을 포함할 수 있습니다.",
  price_notice: "가격은 확인일 기준이며 변동될 수 있습니다.",
};

const searchStructure = {
  search_title: "자취방 냉방 준비 검색 체크리스트",
  h2: ["냉방 문제 확인", "제품 비교", "가격 확인", "자주 묻는 질문"],
  faq: blogDraft.faq,
  comparison_table: "| 기준 | 확인 |\n| --- | --- |\n| 가격 | 기준일 필요 |",
};

const snsVariant = {
  platform: "instagram",
  format: "carousel",
  hook: "폭염 전에 자취방 냉방을 확인하세요",
  body: "필터와 차광, 전기요금 기준만 먼저 봐도 냉방 준비 실패를 줄일 수 있습니다.",
  cta: "블로그 체크리스트에서 자세히 확인하세요.",
  hashtags: ["자취", "냉방", "체크리스트"],
  score: 76,
};

const compliance = {
  pass: true,
  risk_level: "low",
  export_allowed: true,
  issues: [],
};

const dailyBriefing = {
  goals: "오늘 콘텐츠 1개를 승인 가능한 상태까지 진행합니다.",
  focus_categories: ["자취", "생활"],
  priority_angle: "폭염 전 체크리스트",
  strategy_note: "회사 프로필과 최신 기회 메모를 기준으로 실행 가능한 콘텐츠를 우선합니다.",
};

function openAIResponse(content: unknown, usage?: Record<string, unknown>): Response {
  return Response.json({
    choices: [
      { message: { content: typeof content === "string" ? content : JSON.stringify(content) } },
    ],
    ...(usage === undefined ? {} : { usage }),
  });
}

function claudeResponse(content: unknown, usage?: Record<string, unknown>): Response {
  return Response.json({
    content: [
      { type: "text", text: typeof content === "string" ? content : JSON.stringify(content) },
    ],
    ...(usage === undefined ? {} : { usage }),
  });
}

describe("runtime AI provider selection", () => {
  it("returns OpenAI, Claude, and Ollama adapters when configured", () => {
    expect(
      createRuntimeAIAdapter({
        AI_ADAPTER: "openai",
        OPENAI_API_KEY: "test-key",
        NODE_ENV: "production",
      }),
    ).toBeInstanceOf(OpenAIAdapter);
    expect(
      createRuntimeAIAdapter({
        AI_ADAPTER: "claude",
        CLAUDE_API_KEY: "test-key",
        NODE_ENV: "production",
      }),
    ).toBeInstanceOf(ClaudeAIAdapter);
    expect(
      createRuntimeAIAdapter({
        AI_ADAPTER: "ollama",
        OLLAMA_API_KEY: "test-key",
        OLLAMA_HOST: "https://ollama.com",
        NODE_ENV: "production",
      }),
    ).toBeInstanceOf(OllamaAdapter);
  });

  it("rejects missing provider credentials", () => {
    expect(() => createRuntimeAIAdapter({ AI_ADAPTER: "openai", NODE_ENV: "production" })).toThrow(
      AIAdapterConfigurationError,
    );
    expect(() => createRuntimeAIAdapter({ AI_ADAPTER: "claude", NODE_ENV: "production" })).toThrow(
      AIAdapterConfigurationError,
    );
  });
});

describe("Ollama AI adapter", () => {
  it("calls deepseek-v4-flash cloud chat and parses JSON output", async () => {
    const chatMock = vi.fn().mockResolvedValue({
      message: { content: JSON.stringify(opportunityMemo) },
    });
    const adapter = new OllamaAdapter({ client: { chat: chatMock } });

    await expect(
      adapter.generateOpportunityMemo({ categories: ["자취"], rawItems: [] }),
    ).resolves.toEqual(opportunityMemo);

    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek-v4-flash:cloud",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      }),
    );
  });

  it("fails closed on Ollama chat errors", async () => {
    const chatMock = vi.fn().mockRejectedValue(new Error("subscription required"));
    const adapter = new OllamaAdapter({ client: { chat: chatMock } });

    await expect(
      adapter.generateOpportunityMemo({ categories: ["자취"], rawItems: [] }),
    ).rejects.toThrow(AIProviderResponseError);
  });

  it("uses direct API model names without the local cloud suffix", async () => {
    const chatMock = vi.fn().mockResolvedValue({
      message: { content: JSON.stringify(opportunityMemo) },
    });
    const adapter = new OllamaAdapter({
      client: { chat: chatMock },
      host: "https://ollama.com",
      model: "deepseek-v4-flash:cloud",
    });

    await adapter.generateOpportunityMemo({ categories: ["자취"], rawItems: [] });

    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek-v4-flash",
      }),
    );
  });

  it("sends the direct API authorization header through the Ollama client", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        model: "deepseek-v4-flash",
        created_at: new Date(0).toISOString(),
        message: { role: "assistant", content: JSON.stringify(opportunityMemo) },
        done: true,
      }),
    );
    const adapter = new OllamaAdapter({
      apiKey: "test-ollama-key",
      fetch: fetchMock,
      host: "https://ollama.com",
      model: "deepseek-v4-flash:cloud",
    });

    await expect(
      adapter.generateOpportunityMemo({ categories: ["자취"], rawItems: [] }),
    ).resolves.toEqual(opportunityMemo);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/ollama\.com(?::443)?\/api\/chat$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-ollama-key",
        }),
      }),
    );
  });
});

describe("AI provider adapters", () => {
  it("parses all OpenAI method outputs through schemas", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(openAIResponse(opportunityMemo))
      .mockResolvedValueOnce(openAIResponse(blogDraft))
      .mockResolvedValueOnce(openAIResponse(searchStructure))
      .mockResolvedValueOnce(openAIResponse(snsVariant))
      .mockResolvedValueOnce(openAIResponse({ score: 81 }))
      .mockResolvedValueOnce(openAIResponse(compliance))
      .mockResolvedValueOnce(openAIResponse(dailyBriefing));
    const adapter = new OpenAIAdapter({ apiKey: "test-key", fetch: fetchMock });

    await expect(
      adapter.generateOpportunityMemo({ categories: ["자취"], rawItems: [] }),
    ).resolves.toEqual(opportunityMemo);
    await expect(
      adapter.generateBlogDraft({ topic: "냉방", products: [], companyProfile: {} }),
    ).resolves.toEqual(blogDraft);
    await expect(
      adapter.generateSearchStructure({ topic: "냉방", products: [], companyProfile: {} }),
    ).resolves.toEqual(searchStructure);
    await expect(
      adapter.generateSNSVariant(
        { topic: "냉방", products: [], companyProfile: {} },
        { platform: "instagram", format: "carousel" },
      ),
    ).resolves.toEqual(snsVariant);
    await expect(adapter.scoreHomefeed(blogDraft)).resolves.toBe(81);
    await expect(
      adapter.checkCompliance({
        bodyMarkdown: blogDraft.body_markdown,
        hasShoppingConnectLinks: true,
        hasPriceMentions: true,
      }),
    ).resolves.toEqual(compliance);
    await expect(
      adapter.generateDailyBriefing({
        companyProfile: { companyName: "Paperclip", primaryCategories: ["자취", "생활"] },
        opportunityMemoContext: { latestMemo: { topic: opportunityMemo.topic } },
      }),
    ).resolves.toEqual(dailyBriefing);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("parses all Claude method outputs through schemas", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(claudeResponse(opportunityMemo))
      .mockResolvedValueOnce(claudeResponse(blogDraft))
      .mockResolvedValueOnce(claudeResponse(searchStructure))
      .mockResolvedValueOnce(claudeResponse(snsVariant))
      .mockResolvedValueOnce(claudeResponse({ score: 81 }))
      .mockResolvedValueOnce(claudeResponse(compliance))
      .mockResolvedValueOnce(claudeResponse(dailyBriefing));
    const adapter = new ClaudeAIAdapter({ apiKey: "test-key", fetch: fetchMock });

    await expect(
      adapter.generateOpportunityMemo({ categories: ["자취"], rawItems: [] }),
    ).resolves.toEqual(opportunityMemo);
    await expect(
      adapter.generateBlogDraft({ topic: "냉방", products: [], companyProfile: {} }),
    ).resolves.toEqual(blogDraft);
    await expect(
      adapter.generateSearchStructure({ topic: "냉방", products: [], companyProfile: {} }),
    ).resolves.toEqual(searchStructure);
    await expect(
      adapter.generateSNSVariant(
        { topic: "냉방", products: [], companyProfile: {} },
        { platform: "instagram", format: "carousel" },
      ),
    ).resolves.toEqual(snsVariant);
    await expect(adapter.scoreHomefeed(blogDraft)).resolves.toBe(81);
    await expect(
      adapter.checkCompliance({
        bodyMarkdown: blogDraft.body_markdown,
        hasShoppingConnectLinks: true,
        hasPriceMentions: true,
      }),
    ).resolves.toEqual(compliance);
    await expect(
      adapter.generateDailyBriefing({
        companyProfile: { companyName: "Paperclip", primaryCategories: ["자취", "생활"] },
        opportunityMemoContext: { latestMemo: { topic: opportunityMemo.topic } },
      }),
    ).resolves.toEqual(dailyBriefing);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("records provider identity, HQ daily briefing step, and usage tokens through injected cost loggers", async () => {
    const openAICostLogger = vi.fn();
    const claudeCostLogger = vi.fn();
    const openAIFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        openAIResponse(dailyBriefing, { prompt_tokens: 12.9, completion_tokens: 7 }),
      );
    const claudeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(claudeResponse(dailyBriefing, { input_tokens: 21, output_tokens: 9 }));

    await new OpenAIAdapter({
      apiKey: "test-key",
      fetch: openAIFetch,
      model: "gpt-4o-mini",
      costLogger: openAICostLogger,
    }).generateDailyBriefing({
      companyProfile: { companyName: "Paperclip", primaryCategories: ["자취"] },
    });
    await new ClaudeAIAdapter({
      apiKey: "test-key",
      fetch: claudeFetch,
      model: "claude-3-5-haiku-latest",
      costLogger: claudeCostLogger,
    }).generateDailyBriefing({
      companyProfile: { companyName: "Paperclip", primaryCategories: ["자취"] },
    });

    expect(openAICostLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai:gpt-4o-mini",
        task: "generateDailyBriefing",
        pipelineStep: "hq",
        inputTokens: 12,
        outputTokens: 7,
        costUsd: expect.any(Number),
      }),
    );
    expect(claudeCostLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude:claude-3-5-haiku-latest",
        task: "generateDailyBriefing",
        pipelineStep: "hq",
        inputTokens: 21,
        outputTokens: 9,
        costUsd: expect.any(Number),
      }),
    );
  });

  it("fails closed on malformed provider JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(openAIResponse("not-json"));
    const adapter = new OpenAIAdapter({ apiKey: "test-key", fetch: fetchMock });

    await expect(
      adapter.generateOpportunityMemo({ categories: ["자취"], rawItems: [] }),
    ).rejects.toThrow(AIProviderResponseError);
  });

  it("fails closed on schema-invalid provider output", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(claudeResponse({ ...searchStructure, h2: ["too few"] }));
    const adapter = new ClaudeAIAdapter({ apiKey: "test-key", fetch: fetchMock });

    await expect(
      adapter.generateSearchStructure({ topic: "냉방", products: [], companyProfile: {} }),
    ).rejects.toThrow(AIOutputValidationError);
  });
  it("fails closed on non-OK provider HTTP responses", async () => {
    const openAIFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "rate limited" }, { status: 429 }));
    const claudeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status: 503 }));

    await expect(
      new OpenAIAdapter({ apiKey: "test-key", fetch: openAIFetch }).generateOpportunityMemo({
        categories: ["자취"],
        rawItems: [],
      }),
    ).rejects.toThrow(AIProviderResponseError);
    await expect(
      new ClaudeAIAdapter({ apiKey: "test-key", fetch: claudeFetch }).generateBlogDraft({
        topic: "냉방",
        products: [],
        companyProfile: {},
      }),
    ).rejects.toThrow(AIProviderResponseError);
  });
});
