import { z } from "zod";

type ProviderTask =
  | "generateOpportunityMemo"
  | "generateBlogDraft"
  | "generateSearchStructure"
  | "generateSNSVariant"
  | "scoreHomefeed"
  | "checkCompliance"
  | "generateDailyBriefing";

type PromptSpec = {
  readonly department: string;
  readonly mission: string;
  readonly writingRules: readonly string[];
  readonly outputContract: string;
};

const promptTemplateSchema = z.object({
  name: z.string(),
  version: z.number().int(),
  template: z.string(),
});

const playbookSchema = z.object({
  category: z.string(),
  homefeedToneGuidance: z.string().nullable().optional(),
  searchGuidance: z.string().nullable().optional(),
  productRecommendations: z.array(z.string()).optional(),
  commonMistakes: z.array(z.string()).optional(),
  winningPatterns: z.array(z.string()).optional(),
});

const competitorBenchmarkSchema = z.object({
  source: z.literal("naver_blog_raw_items"),
  query: z.string(),
  patterns: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().optional(),
      patternSummary: z.string(),
      originalityGuard: z.string(),
    }),
  ),
});

const contentPromptContextSchema = z.object({
  generationContext: z
    .object({
      promptTemplate: promptTemplateSchema.optional(),
      categoryPlaybooks: z.array(playbookSchema).optional(),
      competitorBenchmark: competitorBenchmarkSchema.optional(),
    })
    .optional(),
});

const promptSpecs = {
  generateOpportunityMemo: {
    department: "Hermes Research Division",
    mission: "검색·크롤링·성과 기억을 조합해 오늘 실행할 가치가 있는 기회를 고른다.",
    writingRules: [
      "주제는 하루 안에 블로그 원문과 제휴 링크까지 만들 수 있을 만큼 구체적으로 쓴다.",
      "why_now에는 계절성, 검색 신호, 상품성 중 최소 두 가지 근거를 넣는다.",
      "4축 점수는 낙관하지 말고 근거 문장과 함께 보수적으로 채점한다.",
    ],
    outputContract:
      "Output object: topic string; why_now string; homefeed_angle string; search_angle string; interest_tags string[]; homefeed_score/search_score/revenue_score/risk_score integers 0-100; homefeed_reasons/search_reasons/revenue_reasons strings; score_reasons string.",
  },
  generateBlogDraft: {
    department: "Naver Blog Desk",
    mission: "HomeFeed, Search, ShoppingConnect 설계를 하나의 네이버 블로그 원문으로 합친다.",
    writingRules: [
      "첫 화면은 공감 또는 결론을 먼저 주고, 문제-기준-비교-선택-주의사항 순서로 전개한다.",
      "직접 써본 척하지 말고 출처, 가격 기준일, 제휴 고지를 본문 상단과 관련 문단에 반영한다.",
      "상품 추천은 링크 클릭 유도보다 독자의 선택 기준을 먼저 설명한 뒤 CTA를 붙인다.",
      "본문은 Markdown으로 작성하고 H2/H3, 비교표, FAQ가 자연스럽게 이어지게 한다.",
      "경쟁 콘텐츠는 제목·문단·표현을 복제하지 말고 문제 제기, 비교 기준, FAQ 각도만 추출한다.",
    ],
    outputContract:
      "Output object: homefeed_title string[3..10]; search_title string; thumbnail_text string[1..5]; first_screen string; body_markdown markdown string at least 100 chars; optional comparison_table string; faq array of at least 3 {question, answer}; optional disclosure_text; optional price_notice.",
  },
  generateSearchStructure: {
    department: "Search Desk",
    mission: "검색 의도를 제목, H2/H3, FAQ, 비교표로 구조화한다.",
    writingRules: [
      "검색 제목은 핵심 키워드와 사용자가 비교하려는 기준을 함께 담는다.",
      "H2는 3~4개로 제한하고 구매 전 확인 순서대로 배열한다.",
      "FAQ는 실제 검색자가 망설일 질문으로 만들고 답은 짧고 검증 가능하게 쓴다.",
    ],
    outputContract:
      "Output object: search_title string; h2 string[3..4]; faq array of at least 3 {question, answer}; comparison_table markdown table string.",
  },
  generateSNSVariant: {
    department: "Social Desk",
    mission:
      "블로그 원문과 제휴 상품 맥락을 Instagram, Threads, X에 맞는 강한 후킹형 소셜 카피로 바꾼다.",
    writingRules: [
      "sourceDraftMarkdown의 핵심 판단 기준을 유지하고 새 사실을 invent하지 않는다.",
      "첫 문장은 3초 안에 멈춰 세우는 hook이어야 하며 문제공감, 실수지적, 비교선택, 체크리스트, 계절타이밍 중 하나를 쓴다.",
      "PAS(Problem-Agitate-Solve) 또는 AIDA(Attention-Interest-Desire-Action) 구조로 전개하되 공포·혐오·효능 단정은 피한다.",
      "Instagram은 저장하고 넘겨볼 수 있는 카드형 문장, Threads는 댓글을 부르는 대화형 문장, X는 압축된 한 줄 훅과 근거 중심으로 쓴다.",
      "제휴 상품이 있으면 클릭 유도보다 선택 기준을 먼저 말하고, 제휴/쇼핑커넥트 고지와 가격 변동 가능성을 자연스럽게 포함한다.",
      "CTA는 블로그 본문 또는 체크리스트 확인으로 유도하되 과장된 수익·효능 표현을 피한다.",
    ],
    outputContract:
      "Output object: platform one of instagram, threads, x; format string; hook string; body string; cta string; hashtags string[] max 20; optional score integer 0-100.",
  },
  scoreHomefeed: {
    department: "HomeFeed Desk",
    mission: "홈피드에서 클릭될 가능성을 보수적으로 점수화한다.",
    writingRules: [
      "문제 공감, 즉시성, 첫 화면 명료도, 낚시성 위험을 함께 본다.",
      "과장 제목이면 클릭 가능성이 있어도 감점한다.",
    ],
    outputContract: "Output object: score integer 0-100 only.",
  },
  checkCompliance: {
    department: "Compliance Desk",
    mission: "광고표시, 가격 기준일, 출처, 과장 표현을 검수해 Export 가능 여부를 정한다.",
    writingRules: [
      "규칙 기반 위반은 LLM 판단보다 우선한다.",
      "문제 위치와 수정 문장을 함께 제시한다.",
      "쇼핑 링크, 가격, 직접 사용 후기체, 출처 누락을 중점적으로 본다.",
    ],
    outputContract:
      "Evaluate bodyMarkdown against hasShoppingConnectLinks, hasPriceMentions, and every active policyRules entry. The AI semantic review is advisory and additive: report policy, disclosure, price, source, claim, and clickbait risks as issues, but never claim a pass when active policies are violated. Output object: pass boolean; risk_level one of low, medium, high; export_allowed boolean; issues array of {type string, field string, severity low|medium|high, message string, optional suggested_fix string}.",
  },
  generateDailyBriefing: {
    department: "Paperclip HQ",
    mission: "오늘의 운영 목표, 집중 카테고리, 우선순위 각도를 결정한다.",
    writingRules: [
      "30분 안에 실행할 수 있는 결정을 우선한다.",
      "최근 메모와 회사 프로필을 근거로 한 문장씩 명확하게 쓴다.",
    ],
    outputContract:
      "Output object: goals string; focus_categories string[1..5]; priority_angle string; strategy_note string.",
  },
} as const satisfies Record<ProviderTask, PromptSpec>;

function taskSpec(task: string): PromptSpec {
  const parsed = z
    .enum([
      "generateOpportunityMemo",
      "generateBlogDraft",
      "generateSearchStructure",
      "generateSNSVariant",
      "scoreHomefeed",
      "checkCompliance",
      "generateDailyBriefing",
    ])
    .safeParse(task);
  return parsed.success
    ? promptSpecs[parsed.data]
    : {
        department: "Paperclip Company OS",
        mission: "요청된 작업을 안전한 JSON 산출물로 변환한다.",
        writingRules: ["입력에 없는 사실을 만들지 않는다.", "필수 필드를 누락하지 않는다."],
        outputContract: "Output object must match the named task.",
      };
}

function contentContextLines(input: unknown): readonly string[] {
  const parsed = contentPromptContextSchema.safeParse(input);
  if (!parsed.success) {
    return [];
  }

  const template = parsed.data.generationContext?.promptTemplate;
  const playbooks = parsed.data.generationContext?.categoryPlaybooks ?? [];
  const competitorBenchmark = parsed.data.generationContext?.competitorBenchmark;
  return [
    ...(template === undefined
      ? []
      : [
          `Active prompt template: ${template.name} v${template.version}`,
          `Template body:\n${template.template}`,
        ]),
    ...playbooks.map((playbook) =>
      [
        `Category playbook: ${playbook.category}`,
        playbook.homefeedToneGuidance === undefined || playbook.homefeedToneGuidance === null
          ? null
          : `HomeFeed tone: ${playbook.homefeedToneGuidance}`,
        playbook.searchGuidance === undefined || playbook.searchGuidance === null
          ? null
          : `Search guidance: ${playbook.searchGuidance}`,
        `Recommended products: ${(playbook.productRecommendations ?? []).join(", ")}`,
        `Common mistakes to avoid: ${(playbook.commonMistakes ?? []).join(", ")}`,
        `Winning patterns: ${(playbook.winningPatterns ?? []).join(", ")}`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    ),
    ...(competitorBenchmark === undefined
      ? []
      : [
          [
            `Competitor benchmark source: ${competitorBenchmark.source}`,
            `Benchmark query: ${competitorBenchmark.query}`,
            "Use competitor content only for pattern extraction. Do not copy competitor titles, paragraph order, unique expressions, claims, or examples.",
            ...competitorBenchmark.patterns.map((pattern) =>
              [
                `- Title: ${pattern.title}`,
                `  URL: ${pattern.url}`,
                pattern.snippet === undefined ? null : `  Snippet: ${pattern.snippet}`,
                `  Pattern: ${pattern.patternSummary}`,
                `  Originality guard: ${pattern.originalityGuard}`,
              ]
                .filter((line) => line !== null)
                .join("\n"),
            ),
          ].join("\n"),
        ]),
  ];
}

export function providerSystemPrompt(): string {
  return [
    "You are Paperclip Company OS, a deterministic production JSON generator for a Korean commerce content system.",
    "Operate as the named department. Follow Korean-first commerce writing, compliance, and manual publishing constraints.",
  ].join(" ");
}

export function buildProviderPrompt(task: string, input: unknown): string {
  const spec = taskSpec(task);
  return [
    `Department: ${spec.department}`,
    `Task: ${task}`,
    `Mission: ${spec.mission}`,
    "Return exactly one JSON value and no markdown, comments, or surrounding text.",
    "Use the requested schema field names exactly. Do not omit required fields.",
    "Never invent product usage, price, source, or policy facts that are absent from the input.",
    "Writing rules:",
    ...spec.writingRules.map((rule) => `- ${rule}`),
    ...contentContextLines(input),
    spec.outputContract,
    `Input JSON: ${JSON.stringify(input)}`,
  ].join("\n");
}
