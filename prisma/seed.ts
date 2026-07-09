import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const promptTemplates = [
  {
    id: "prompt_blog_draft_generation_v1",
    name: "blog_draft_generation",
    engine: "content",
    version: 1,
    template: [
      "Naver Blog Desk는 한 주제에서 홈피드형 첫 화면, 검색형 구조, 제휴 수익 동선을 하나의 Markdown 원문으로 통합한다.",
      "작성 순서: 공감/결론 첫 화면 -> 선택 기준 -> 상품 비교 -> 가격/출처/제휴 고지 -> FAQ -> CTA.",
      "경쟁 블로그 원자료가 있으면 문제 제기, 비교 기준, FAQ 각도만 추출하고 제목·문단 순서·고유 표현은 재사용하지 않는다.",
      "직접 사용하지 않은 상품은 후기처럼 쓰지 말고, 가격은 확인일 기준이며 변동 가능하다고 명시한다.",
      "독자가 바로 판단할 수 있도록 기준과 제외 조건을 먼저 제시하고 링크 클릭은 마지막에 자연스럽게 유도한다.",
    ].join("\n"),
    variables: {
      required: ["topic", "products", "companyProfile", "generationContext"],
      outputs: ["body_markdown", "homefeed_title", "search_title", "comparison_table", "faq"],
    },
  },
  {
    id: "prompt_search_structure_generation_v1",
    name: "search_structure_generation",
    engine: "content",
    version: 1,
    template: [
      "Search Desk는 검색 의도와 구매 전 비교 기준을 H2/H3, FAQ, 비교표로 구조화한다.",
      "검색 제목은 핵심 키워드, 상황, 비교 기준을 포함한다.",
      "FAQ는 실제 검색자가 망설이는 질문으로 작성하고, 답변은 검증 가능한 범위에서 짧게 쓴다.",
      "비교표는 가격, 사용 상황, 주의점, 대체 선택지를 포함한다.",
    ].join("\n"),
    variables: {
      required: ["topic", "products", "categoryPlaybooks"],
      outputs: ["search_title", "h2", "comparison_table", "faq"],
    },
  },
  {
    id: "prompt_sns_variant_generation_v1",
    name: "sns_variant_generation",
    engine: "content",
    version: 1,
    template: [
      "Social Desk는 블로그 원문과 제휴 상품 맥락을 채널별 강한 후킹 카피로 변환한다.",
      "첫 문장은 3초 안에 멈춰 세우는 문제공감, 실수지적, 비교선택, 체크리스트, 계절타이밍 훅 중 하나로 시작한다.",
      "PAS 또는 AIDA 구조를 사용하되 원문에 없는 효능, 가격, 사용 경험을 새로 만들지 않는다.",
      "제휴/쇼핑커넥트 상품이 있으면 선택 기준을 먼저 말하고 고지·가격 변동 가능성·블로그 확인 CTA를 자연스럽게 포함한다.",
      "Instagram은 저장형 카드 문장, Threads는 댓글을 부르는 대화형 흐름, X는 짧은 훅과 근거 요약 중심으로 쓴다.",
    ].join("\n"),
    variables: {
      required: ["topic", "sourceDraftMarkdown", "profile"],
      outputs: ["hook", "body", "cta", "hashtags"],
    },
  },
  {
    id: "prompt_naver_clip_script_generation_v1",
    name: "naver_clip_script_generation",
    engine: "content",
    version: 1,
    template: [
      "Naver Clip Desk는 블로그 원문을 20~30초 숏폼 스크립트로 바꾼다.",
      "0~2초에는 문제를 제시하고, 3~20초에는 선택 기준 3개를 보여주며, 마지막에는 블로그 본문 확인으로 유도한다.",
      "정보태그와 쇼핑태그는 과장 없이 본문 근거와 연결한다.",
    ].join("\n"),
    variables: {
      required: ["topic", "draft", "products"],
      outputs: ["hook", "body", "cta", "hashtags"],
    },
  },
] as const;

const categoryPlaybooks = [
  {
    id: "playbook_living_alone_v1",
    category: "자취",
    homefeedToneGuidance:
      "혼자 사는 사람이 오늘 당장 겪는 불편을 먼저 짚고, 바로 실행 가능한 기준을 제시한다.",
    searchGuidance:
      "공간 크기, 예산, 관리 난이도, 대체재를 비교하는 체크리스트형 검색 구조를 우선한다.",
    productRecommendations: ["소형 생활가전", "청소·수납 소모품", "계절 관리용품"],
    commonMistakes: ["직접 써본 듯한 후기체", "가격 기준일 누락", "작은 공간 제약 무시"],
    winningPatterns: ["문제-기준-비교-주의사항-CTA"],
  },
  {
    id: "playbook_seasonal_v1",
    category: "계절",
    homefeedToneGuidance:
      "날씨 변화로 생기는 즉시성 있는 문제를 첫 문장에 놓고, 준비 시점을 명확히 말한다.",
    searchGuidance: "계절 키워드, 사용 시기, 보관/교체 주기, 가격 변동 가능성을 FAQ에 반영한다.",
    productRecommendations: ["장마 대비용품", "냉난방 보조용품", "방충·습기 관리용품"],
    commonMistakes: ["공포 마케팅", "효능 단정", "시즌 종료 후 stale 링크 방치"],
    winningPatterns: ["지금 필요한 이유-체크 기준-교체/보관 팁"],
  },
  {
    id: "playbook_cleaning_v1",
    category: "청소",
    homefeedToneGuidance: "귀찮음을 줄이는 순서와 실패를 줄이는 기준을 짧게 제시한다.",
    searchGuidance: "오염 유형, 소재별 주의점, 소모품 교체 주기, 안전 문구를 구조에 포함한다.",
    productRecommendations: ["청소 소모품", "수납 도구", "습기·냄새 관리용품"],
    commonMistakes: ["만능 효과 주장", "소재별 금지 조건 누락", "안전 주의사항 생략"],
    winningPatterns: ["상황별 표-주의사항-추천 기준"],
  },
] as const;

async function main(): Promise<void> {
  const workspace = await prisma.workspace.upsert({
    where: { id: "default_workspace" },
    update: {},
    create: {
      id: "default_workspace",
      name: "default",
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: "default_company_profile" },
    update: {},
    create: {
      id: "default_company_profile",
      workspaceId: workspace.id,
      companyName: "Paperclip Company",
      primaryCategories: ["자취", "계절", "청소"],
      blockedCategories: ["건강", "의료", "투자", "법률", "다이어트"],
      toneRules: "친근하지만 신뢰감 있게, 직접 써본 것처럼 단정하지 않는다.",
      contentPrinciples: "문제 중심, 출처 명시, 대가성 문구와 가격 기준일 우선.",
      revenueGoalMonthly: 500000,
    },
  });

  await prisma.policyRule.createMany({
    data: [
      {
        ruleType: "compliance",
        ruleCode: "shopping_connect_disclosure_required",
        description: "쇼핑커넥트 링크가 있으면 대가성 문구가 본문 상단에 필요하다.",
      },
      {
        ruleType: "compliance",
        ruleCode: "price_checked_at_required",
        description: "가격을 포함하면 가격 확인일과 변동 가능 문구가 필요하다.",
      },
      {
        ruleType: "content",
        ruleCode: "unused_product_review_forbidden",
        description: "직접 사용하지 않은 상품은 후기체로 단정하지 않는다.",
      },
    ],
    skipDuplicates: true,
  });

  for (const template of promptTemplates) {
    await prisma.promptTemplate.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        engine: template.engine,
        version: template.version,
        template: template.template,
        variables: template.variables,
      },
      create: template,
    });
  }

  for (const playbook of categoryPlaybooks) {
    await prisma.categoryPlaybook.upsert({
      where: { id: playbook.id },
      update: {
        category: playbook.category,
        homefeedToneGuidance: playbook.homefeedToneGuidance,
        searchGuidance: playbook.searchGuidance,
        productRecommendations: [...playbook.productRecommendations],
        commonMistakes: [...playbook.commonMistakes],
        winningPatterns: [...playbook.winningPatterns],
      },
      create: {
        ...playbook,
        productRecommendations: [...playbook.productRecommendations],
        commonMistakes: [...playbook.commonMistakes],
        winningPatterns: [...playbook.winningPatterns],
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
