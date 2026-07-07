import { readFileSync } from "node:fs";
import { ExportFormat, PackageStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  createDraftRecoveryRecord,
  draftRecoveryStorageKey,
  emptyContentPackageDetail,
  isExplicitDemoPackageId,
  parseDraftRecoveryRecord,
} from "@/components/content/ContentPackageDetail";
import { demoContentPackage } from "@/components/content/demoPackage";
import type { ComplianceInput } from "@/lib/ai/adapter";
import { AIOutputValidationError, parseBlogDraftOutput } from "@/lib/ai/adapter";
import { applyComplianceFixes, evaluateCompliance } from "@/lib/compliance/rules";
import {
  deriveComplianceCheckExportAllowed,
  mergeComplianceIssues,
  serializeComplianceCheck,
} from "@/lib/compliance/service";
import {
  createHomefeedTitleCandidates,
  createThumbnailCandidates,
  hasFullHookCoverage,
} from "@/lib/content/titleCandidates";
import {
  createExportBundle,
  createExportManifest,
  renderMarkdownExport,
  renderNaverHtmlExport,
} from "@/lib/export/render";
import { buildRetentionCleanupPlan } from "@/lib/retention/service";

const contentDetailSource = readFileSync("components/content/ContentPackageDetail.tsx", "utf8");
const contentLayoutSource = readFileSync("components/content/ContentPackageLayout.tsx", "utf8");
const contentTypesSource = readFileSync("components/content/types.ts", "utf8");
const contentSerializerSource = readFileSync("lib/content/serializers.ts", "utf8");
const contentServiceSource = readFileSync("lib/content/service.ts", "utf8");
const titleServiceSource = readFileSync("lib/content/titleService.ts", "utf8");
const searchStructureSource = readFileSync("lib/content/searchStructure.ts", "utf8");
const generationContextSource = readFileSync("lib/content/generationContext.ts", "utf8");
const aiAdapterSource = readFileSync("lib/ai/adapter.ts", "utf8");
const complianceServiceSource = readFileSync("lib/compliance/service.ts", "utf8");
const exportServiceSource = readFileSync("lib/export/service.ts", "utf8");
const exportRouteSource = readFileSync("app/api/content-packages/[id]/export/route.ts", "utf8");
const contentPackagesPageSource = readFileSync("app/(app)/packages/page.tsx", "utf8");
const prismaSchemaSource = readFileSync("prisma/schema.prisma", "utf8");
const initialMigrationSource = readFileSync(
  "prisma/migrations/00000000000000_init/migration.sql",
  "utf8",
);
const retentionServiceSource = readFileSync("lib/retention/service.ts", "utf8");

describe("P3 content engine contract", () => {
  it("rejects malformed AI blog draft output before persistence", () => {
    expect(() =>
      parseBlogDraftOutput({
        homefeed_title: ["only one"],
        search_title: "검색 제목",
        thumbnail_text: ["썸네일"],
        first_screen: "too short",
        body_markdown: "too short",
        faq: [],
      }),
    ).toThrow(AIOutputValidationError);

    try {
      parseBlogDraftOutput({ body_markdown: "too short" });
    } catch (error) {
      expect(error).toBeInstanceOf(AIOutputValidationError);
      expect(error).toMatchObject({ code: "AI_OUTPUT_SCHEMA_INVALID", task: "generateBlogDraft" });
    }
  });

  it("creates ten homefeed title candidates with full hook coverage and one selected title", () => {
    const candidates = createHomefeedTitleCandidates("장마철 자취방 습기");

    expect(candidates).toHaveLength(10);
    expect(candidates.filter((candidate) => candidate.selected)).toHaveLength(1);
    expect(hasFullHookCoverage(candidates)).toBe(true);
  });

  it("creates five thumbnail candidates with one selected option", () => {
    const candidates = createThumbnailCandidates("장마철 자취방 습기");

    expect(candidates).toHaveLength(5);
    expect(candidates.filter((candidate) => candidate.selected)).toHaveLength(1);
  });

  it("creates search structure with required headings, faq, and comparison table", async () => {
    const { MockAIAdapter } = await import("@/lib/ai/mockAdapter");
    const output = await new MockAIAdapter().generateSearchStructure({
      topic: "장마철 자취방 습기",
      products: [],
      companyProfile: {},
    });

    expect(output.h2).toHaveLength(4);
    expect(output.faq.length).toBeGreaterThanOrEqual(3);
    expect(output.comparison_table).toContain("| 기준 |");
  });

  it("keeps the DB-backed packages index out of static prerender", () => {
    expect(contentPackagesPageSource).toContain('export const dynamic = "force-dynamic"');
    expect(contentPackagesPageSource).toContain("listContentPackages(null)");
  });
});

describe("G005 generation context contract", () => {
  it("passes prompt template and category playbook context into content generation", () => {
    expect(aiAdapterSource).toContain("ContentGenerationContext");
    expect(aiAdapterSource).toContain("categoryPlaybooks");
    expect(aiAdapterSource).toContain("promptTemplate");
    expect(generationContextSource).toContain("prisma.categoryPlaybook.findMany");
    expect(generationContextSource).toContain("prisma.promptTemplate.findMany");
    expect(generationContextSource).toContain("MAX_PLAYBOOK_CONTEXT_ROWS");
    expect(generationContextSource).toContain("blog_draft_generation");
    expect(generationContextSource).toContain("search_structure_generation");

    for (const source of [contentServiceSource, searchStructureSource]) {
      expect(source).toContain("loadContentGenerationContext");
      expect(source).toContain("generationContext");
      expect(source).toContain("shoppingConnectLinks: contentPackage.shoppingConnectLinks");
    }
    expect(contentServiceSource).toContain('task: "generateBlogDraft"');
    expect(searchStructureSource).toContain('task: "generateSearchStructure"');
    expect(generationContextSource).toContain("MAX_PROMPT_TEMPLATE_QUERY_ROWS");
  });

  it("lets the mock adapter reflect supplied playbook and template context", async () => {
    const { MockAIAdapter } = await import("@/lib/ai/mockAdapter");
    const generationContext = {
      categoryPlaybooks: [
        {
          category: "장마",
          homefeedToneGuidance: "공감형 첫 화면",
          searchGuidance: "비교표 중심 검색 구조",
          productRecommendations: ["제습제"],
          commonMistakes: ["과장된 건조 효과"],
          winningPatterns: ["문제-해결-비교"],
        },
      ],
      promptTemplate: {
        id: "prompt_1",
        name: "blog_draft_generation",
        engine: "content",
        version: 3,
        template: "Nunjucks template body",
        variables: { topic: "string" },
      },
    };

    const adapter = new MockAIAdapter();
    const draft = await adapter.generateBlogDraft({
      topic: "장마철 습기",
      products: [],
      companyProfile: {},
      generationContext,
    });
    const search = await adapter.generateSearchStructure({
      topic: "장마철 습기",
      products: [],
      companyProfile: {},
      generationContext,
    });

    expect(draft.first_screen).toContain("공감형 첫 화면");
    expect(draft.body_markdown).toContain("문제-해결-비교");
    expect(draft.body_markdown).toContain("blog_draft_generation v3");
    expect(search.search_title).toContain("비교표 중심 검색 구조");
    expect(search.h2[0]).toBe("비교표 중심 검색 구조");
  });

  it("prefers exact playbook and prompt template matches over broad partial matches", async () => {
    vi.resetModules();
    const exactPlaybook = {
      id: "playbook_exact",
      category: "장마",
      homefeedToneGuidance: "정확한 장마 홈피드",
      searchGuidance: "정확한 장마 검색",
      productRecommendations: ["제습제"],
      commonMistakes: ["과장된 건조 효과"],
      winningPatterns: ["문제-해결-비교"],
    };
    const partialPlaybooks = Array.from({ length: 24 }, (_, index) => ({
      ...exactPlaybook,
      id: `playbook_partial_${index}`,
      category: `장마철 주변 키워드 ${index}`,
      homefeedToneGuidance: `부분 홈피드 ${index}`,
      searchGuidance: `부분 검색 ${index}`,
    }));
    const exactTemplate = {
      id: "exact_template",
      name: "blog_draft_generation",
      engine: "content",
      version: 2,
      template: "exact template",
      variables: { topic: "string" },
      updatedAt: new Date("2026-07-06T01:00:00.000Z"),
    };
    const promptTemplateFindMany = vi.fn(
      async (query: { readonly where?: Record<string, unknown> }) =>
        Object.hasOwn(query.where ?? {}, "name")
          ? [exactTemplate]
          : [
              {
                ...exactTemplate,
                id: "partial_high_version",
                name: "experimental_blog_draft_generation_shadow",
                version: 99,
                template: "wrong template",
                updatedAt: new Date("2026-07-06T02:00:00.000Z"),
              },
            ],
    );
    const categoryPlaybookFindMany = vi.fn(
      async (query: { readonly where?: Record<string, unknown> }) =>
        Object.hasOwn(query.where ?? {}, "category") ? [exactPlaybook] : partialPlaybooks,
    );
    vi.doMock("@/lib/db", () => ({
      prisma: {
        categoryPlaybook: { findMany: categoryPlaybookFindMany },
        promptTemplate: { findMany: promptTemplateFindMany },
      },
    }));

    try {
      const { loadContentGenerationContext } = await import("@/lib/content/generationContext");
      const context = await loadContentGenerationContext({
        task: "generateBlogDraft",
        topic: "장마철 습기",
        shoppingConnectLinks: [{ isActive: true, product: { category: "장마" } }],
        companyProfile: { primaryCategories: ["장마"] },
      });

      expect(categoryPlaybookFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: expect.any(Object) }),
          take: expect.any(Number),
        }),
      );
      expect(promptTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ name: expect.any(Object) }),
          take: expect.any(Number),
        }),
      );
      expect(context.categoryPlaybooks[0]).toMatchObject({
        category: "장마",
        homefeedToneGuidance: "정확한 장마 홈피드",
      });
      expect(context.promptTemplate).toMatchObject({
        id: "exact_template",
        name: "blog_draft_generation",
        version: 2,
      });
    } finally {
      vi.doUnmock("@/lib/db");
      vi.resetModules();
    }
  });

  it("passes loaded generation context through runtime blog and search generation", async () => {
    vi.resetModules();
    const companyProfile = { primaryCategories: ["장마"] };
    const shoppingConnectLinks = [{ isActive: true, product: { category: "장마" } }];
    const contentPackage = {
      id: "pkg_1",
      status: PackageStatus.selected,
      progress: 0.1,
      topic: { title: "장마철 습기" },
      shoppingConnectLinks,
      drafts: [],
    };
    const generationContext = {
      categoryPlaybooks: [
        {
          category: "장마",
          homefeedToneGuidance: "공감형 첫 화면",
          searchGuidance: "비교표 중심 검색 구조",
          productRecommendations: ["제습제"],
          commonMistakes: ["과장된 건조 효과"],
          winningPatterns: ["문제-해결-비교"],
        },
      ],
      promptTemplate: {
        id: "prompt_1",
        name: "blog_draft_generation",
        engine: "content",
        version: 3,
        template: "Nunjucks template body",
        variables: { topic: "string" },
      },
    };
    const loadContentGenerationContext = vi.fn(async () => generationContext);
    const generateBlogDraft = vi.fn(async (input) => ({
      homefeed_title: ["제목1", "제목2", "제목3"],
      search_title: "검색 제목",
      thumbnail_text: ["썸네일"],
      first_screen: "공감형 첫 화면 기준을 제시합니다.",
      body_markdown: `장마철 습기 본문입니다. ${"검증된 문장 ".repeat(20)}`,
      comparison_table: "| 기준 | 확인 |\n| --- | --- |",
      faq: [
        { question: "질문1", answer: "답변1" },
        { question: "질문2", answer: "답변2" },
        { question: "질문3", answer: "답변3" },
      ],
      disclosure_text: "쇼핑커넥트 활동을 포함할 수 있습니다.",
      price_notice: "가격은 변동될 수 있습니다.",
      input,
    }));
    const generateSearchStructureMock = vi.fn(async (input) => ({
      search_title: "검색 제목",
      h2: ["비교표 중심 검색 구조", "상품 비교", "가격 기준"],
      faq: [
        { question: "질문1", answer: "답변1" },
        { question: "질문2", answer: "답변2" },
        { question: "질문3", answer: "답변3" },
      ],
      comparison_table: "| 기준 | 확인 |\n| --- | --- |",
      input,
    }));
    const draftCreate = vi.fn(async ({ data }) => ({ id: "draft_1", ...data }));
    const titleCandidateCreateMany = vi.fn(async () => ({ count: 0 }));
    const transitionContentPackageStatus = vi.fn(async () => undefined);
    const mockedModules = [
      "@/lib/ai/runtime",
      "@/lib/company-profile/service",
      "@/lib/content/generationContext",
      "@/lib/content/placement",
      "@/lib/content/repository",
      "@/lib/content/serializers",
      "@/lib/db",
      "@/lib/logging/costBudget",
      "@/lib/logging/costLogger",
    ];

    vi.doMock("@/lib/ai/runtime", () => ({
      createRuntimeAIAdapter: () => ({
        generateBlogDraft,
        generateSearchStructure: generateSearchStructureMock,
      }),
    }));
    vi.doMock("@/lib/company-profile/service", () => ({
      getOrCreateCompanyProfile: vi.fn(async () => companyProfile),
    }));
    vi.doMock("@/lib/content/generationContext", () => ({
      loadContentGenerationContext,
    }));
    vi.doMock("@/lib/content/placement", () => ({
      serializeActivePlacementProducts: vi.fn(() => ["serialized-product"]),
    }));
    vi.doMock("@/lib/content/repository", () => ({
      listContentPackageRecords: vi.fn(async () => []),
      loadContentPackageRecord: vi.fn(async () => contentPackage),
      transitionContentPackageStatus,
      updateContentPackageProgress: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/content/serializers", () => ({
      serializeContentPackage: vi.fn((value) => value),
      serializeDraft: vi.fn((value) => value),
    }));
    vi.doMock("@/lib/db", () => ({
      prisma: {
        draft: {
          create: draftCreate,
          update: vi.fn(async ({ data }) => ({ id: "draft_1", ...data })),
        },
        titleCandidate: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          createMany: titleCandidateCreateMany,
        },
      },
    }));
    vi.doMock("@/lib/logging/costBudget", () => ({
      AI_GENERATION_COST_USD: { contentBlogDraft: 0.02, searchStructure: 0.01 },
      assertAiBudgetAllows: vi.fn(async () => ({
        kind: "allowed",
        budget: { kind: "within_budget", capUsd: 1, totalCostUsd: 0, projectedCostUsd: 0.02 },
      })),
    }));
    vi.doMock("@/lib/logging/costLogger", () => ({
      recordCostLog: vi.fn(async () => undefined),
    }));

    try {
      const { generateContentPackage } = await import("@/lib/content/service");
      const { generateSearchStructure } = await import("@/lib/content/searchStructure");

      await generateContentPackage("pkg_1");
      await generateSearchStructure({ content_package_id: "pkg_1" });

      expect(loadContentGenerationContext).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "generateBlogDraft",
          topic: "장마철 습기",
          shoppingConnectLinks,
          companyProfile,
        }),
      );
      expect(loadContentGenerationContext).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "generateSearchStructure",
          topic: "장마철 습기",
          shoppingConnectLinks,
          companyProfile,
        }),
      );
      expect(generateBlogDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          generationContext,
          products: ["serialized-product"],
          companyProfile,
        }),
      );
      expect(generateSearchStructureMock).toHaveBeenCalledWith(
        expect.objectContaining({
          generationContext,
          products: ["serialized-product"],
          companyProfile,
        }),
      );
      expect(draftCreate).toHaveBeenCalled();
      expect(titleCandidateCreateMany).toHaveBeenCalled();
      expect(transitionContentPackageStatus).toHaveBeenCalled();
    } finally {
      for (const moduleName of mockedModules) {
        vi.doUnmock(moduleName);
      }
      vi.resetModules();
    }
  });
});
describe("P3 G007 staged content package contract", () => {
  it("serializes the documented staged package fields for the detail UI", () => {
    for (const field of [
      "faq",
      "title_candidates",
      "shopping_connect_links",
      "products",
      "compliance_checks",
      "exports",
    ]) {
      expect(contentSerializerSource).toContain(`${field}:`);
    }

    for (const typeField of [
      "readonly faq:",
      "readonly title_candidates:",
      "readonly shopping_connect_links:",
      "readonly products:",
      "readonly compliance_checks:",
      "readonly exports:",
    ]) {
      expect(contentTypesSource).toContain(typeField);
    }
  });

  it("exposes G007 generation controls and staged fields on the content detail UI", () => {
    expect(contentDetailSource).toMatch(
      /\/api\/content-packages\/\$\{(?:packageData\.id|packageId)\}\/generate/,
    );
    for (const route of [
      "/api/optimizers/homefeed/titles",
      "/api/optimizers/search/structure",
      "/api/compliance/check",
    ]) {
      expect(contentDetailSource).toContain(route);
    }

    for (const callback of [
      "onGeneratePackage",
      "onGenerateTitleCandidates",
      "onGenerateSearchStructure",
      "onRunCompliance",
    ]) {
      expect(contentLayoutSource).toContain(callback);
    }

    for (const field of [
      "packageData.title_candidates",
      "packageData.shopping_connect_links",
      "draft.faq",
      "draft.comparison_table",
    ]) {
      expect(contentLayoutSource).toContain(field);
    }

    for (const label of [
      "Title Candidates",
      "Search Structure",
      "Comparison Table",
      "FAQ",
      "Shopping Connect",
    ]) {
      expect(contentLayoutSource).toContain(label);
    }
  });

  it("clears stale generated title candidates before writing a regenerated set", () => {
    expect(contentServiceSource).toContain("prisma.titleCandidate.deleteMany");
    expect(contentServiceSource).toContain("contentPackageId: id");
    expect(contentServiceSource).toContain("prisma.titleCandidate.createMany");
    expect(titleServiceSource).toContain("prisma.titleCandidate.deleteMany");
    expect(titleServiceSource).toContain('kind: "homefeed"');
  });
  it("guards compliance and export handoffs against status regression", () => {
    expect(complianceServiceSource).toContain("compliancePassTransitionStatuses");
    expect(complianceServiceSource).toContain("complianceFailTransitionStatuses");
    expect(complianceServiceSource).toContain("Math.max(input.currentProgress ?? 0, 0.75)");
    expect(exportServiceSource).toContain("exportableStatuses");
    expect(exportServiceSource).toContain("Math.max(input.currentProgress ?? 0, 0.9)");
    expect(exportServiceSource).toContain("Owner approval is required before export.");
    expect(contentDetailSource).toContain(
      "nextComplianceStatus(current.status, check.export_allowed)",
    );
  });
  it("binds compliance checks to the exported package draft", () => {
    expect(complianceServiceSource).toContain(
      "where: { id: input.draft_id, contentPackageId: input.content_package_id }",
    );
    expect(exportServiceSource).toContain("latestCheck.draftId !== draft.id");
    expect(exportServiceSource).toContain("latestCheck.checkedAt < draft.updatedAt");
    expect(exportServiceSource).toContain(
      "deriveComplianceCheckExportAllowed(latestCheck.complianceIssues)",
    );
    expect(exportServiceSource).toContain("include: { complianceIssues: true }");
  });
});

describe("P3 content detail failure contract", () => {
  it("keeps demo mode explicit to the demo package id", () => {
    expect(isExplicitDemoPackageId("demo")).toBe(true);
    expect(isExplicitDemoPackageId("real-package-id")).toBe(false);
    expect(isExplicitDemoPackageId("high-risk-demo")).toBe(false);
  });

  it("uses an empty failed detail state instead of demo package data for real load failures", () => {
    const failedDetail = emptyContentPackageDetail("real-package-id");

    expect(failedDetail.id).toBe("real-package-id");
    expect(failedDetail.status).toBe("load_failed");
    expect(failedDetail.drafts).toEqual([]);
    expect(failedDetail.compliance_checks).toEqual([]);
    expect(failedDetail.products).toEqual([]);
    expect(failedDetail.topic.title).not.toBe(demoContentPackage.topic.title);
    expect(failedDetail.id).not.toBe(demoContentPackage.id);
  });

  it("stores draft recovery records by package and draft identity", () => {
    const record = createDraftRecoveryRecord({
      packageId: "package_1",
      draftId: "draft_1",
      bodyMarkdown: "복구할 본문",
      now: new Date("2026-07-06T00:00:00.000Z"),
    });

    expect(draftRecoveryStorageKey("package_1", "draft_1")).toBe(
      "paperclip:draft-recovery:package_1:draft_1",
    );
    expect(parseDraftRecoveryRecord(JSON.stringify(record), "package_1", "draft_1")).toEqual(
      record,
    );
    expect(parseDraftRecoveryRecord(JSON.stringify(record), "package_2", "draft_1")).toBeNull();
    expect(parseDraftRecoveryRecord(JSON.stringify(record), "package_1", "draft_2")).toBeNull();
    expect(parseDraftRecoveryRecord("not-json", "package_1", "draft_1")).toBeNull();
  });

  it("preserves failed autosave bodies locally and clears them after successful persistence", () => {
    for (const requiredSource of [
      "window.localStorage.setItem",
      "window.localStorage.removeItem",
      "createDraftRecoveryRecord({",
      'setStatus("로컬 임시 저장본 복구됨 · 자동 재전송 대기")',
      'setStatus("자동 저장 실패 · 로컬 보존됨")',
      'setStatus("자동 저장 실패 · 로컬 보존 실패")',
      "clearDraftRecovery(packageId, draft.id)",
      "window.location.assign(`/login?from=/packages/",
    ]) {
      expect(contentDetailSource).toContain(requiredSource);
    }

    expect(contentDetailSource).toContain("body_markdown: draftBody");
    expect(contentDetailSource).toContain("blockDraftReplacementWhileRecovering()");
    expect(contentDetailSource).toContain("canRunPackageActions && !recoveryAvailable");
    expect(contentDetailSource).not.toContain("clearDraftRecovery(packageData.id");
    expect(contentDetailSource).not.toContain("clearDraftRecovery(packageData.id, fixedDraft.id)");
  });

  it("gates demo-only action bypasses by explicit package mode", () => {
    expect(contentDetailSource).toContain('if (isDemoMode && issueId.startsWith("demo"))');
    expect(contentDetailSource).toContain('if (isDemoMode && checkId === "demo_check")');
    expect(contentDetailSource).toContain(
      'if (isDemoMode && packageData.paperclip_decision_id === "demo_decision")',
    );
    expect(contentDetailSource).not.toContain('if (issueId.startsWith("demo"))');
  });

  it("keeps real load failure catch paths on empty failed state", () => {
    expect(contentDetailSource).toContain("setPackageData(emptyContentPackageDetail(packageId));");
    expect(contentDetailSource).toContain('setStatus("불러오기 실패");');
    expect(contentDetailSource).not.toContain("demoPackageForId(packageId)");
  });
});

describe("P3 compliance contract", () => {
  it("blocks export when shopping connect disclosure is missing", () => {
    const result = evaluateCompliance({
      body_markdown: "출처: 네이버 쇼핑\n\n본문에 구매 링크가 포함됩니다.",
      has_shopping_connect_links: true,
      has_price_mentions: false,
    });

    expect(result.risk_level).toBe("high");
    expect(result.export_allowed).toBe(false);
    expect(result.issues.map((issue) => issue.issue_type)).toContain(
      "shopping_connect_disclosure_missing",
    );
  });

  it("blocks export when price notice is missing", () => {
    const result = evaluateCompliance({
      body_markdown: "출처: 네이버 쇼핑\n\n가격은 59,000원입니다.",
      has_shopping_connect_links: false,
      has_price_mentions: true,
    });

    expect(result.risk_level).toBe("high");
    expect(result.export_allowed).toBe(false);
    expect(result.issues.map((issue) => issue.issue_type)).toContain("price_notice_missing");
  });

  it("applies disclosure and price notice fixes to markdown", () => {
    const result = evaluateCompliance({
      body_markdown: "출처: 네이버 쇼핑\n\n가격은 59,000원입니다.",
      has_shopping_connect_links: true,
      has_price_mentions: true,
    });
    const fixedMarkdown = applyComplianceFixes(
      "출처: 네이버 쇼핑\n\n가격은 59,000원입니다.",
      result.issues,
    );

    expect(fixedMarkdown).toContain("쇼핑커넥트 활동");
    expect(fixedMarkdown).toContain("가격은 확인일 기준");
  });
  it("requires owner dismissal before medium-risk checks can allow export", () => {
    const result = evaluateCompliance({
      body_markdown:
        "검증되지 않은 제품을 직접 사용해 보니 좋았습니다. 비교 기준과 FAQ를 포함한 검색형 콘텐츠 본문입니다.",
      has_shopping_connect_links: false,
      has_price_mentions: false,
    });

    expect(result.risk_level).toBe("medium");
    expect(result.export_allowed).toBe(false);
    expect(result.issues.map((issue) => issue.issue_type)).toEqual(
      expect.arrayContaining(["source_attribution_missing", "unverified_direct_use_claim"]),
    );
    expect(
      deriveComplianceCheckExportAllowed([
        { severity: "medium", dismissedAt: new Date("2026-07-06T00:00:00.000Z") },
      ]),
    ).toBe(true);
    expect(deriveComplianceCheckExportAllowed([{ severity: "medium", dismissedAt: null }])).toBe(
      false,
    );
  });

  it("allows low-risk checks while high-risk checks stay export-blocking", () => {
    const lowRisk = evaluateCompliance({
      body_markdown: "출처: 제조사",
      has_shopping_connect_links: false,
      has_price_mentions: false,
    });
    const highRisk = evaluateCompliance({
      body_markdown:
        "출처: 제조사\n\n이 제품은 질병 치료 효과가 있으며 가격은 59,000원입니다. 가격은 확인일 기준이며 변동될 수 있습니다.",
      has_shopping_connect_links: false,
      has_price_mentions: true,
    });

    expect(lowRisk.issues.map((issue) => issue.issue_type)).toContain("content_depth_missing");
    expect(lowRisk.export_allowed).toBe(true);
    expect(highRisk.issues.map((issue) => issue.issue_type)).toContain(
      "unsupported_claim_language",
    );
    expect(highRisk.export_allowed).toBe(false);
    expect(
      deriveComplianceCheckExportAllowed([
        { severity: "high", dismissedAt: new Date("2026-07-06T00:00:00.000Z") },
      ]),
    ).toBe(false);
  });

  it("serializes dismissal audit metadata and export blocking state", () => {
    const check = serializeComplianceCheck({
      id: "check_1",
      contentPackageId: "package_1",
      draftId: "draft_1",
      riskLevel: "medium",
      pass: false,
      exportAllowed: false,
      checkedAt: new Date("2026-07-06T00:00:00.000Z"),
      complianceIssues: [
        {
          id: "issue_1",
          complianceCheckId: "check_1",
          issueType: "source_attribution_missing",
          severity: "medium",
          message: "출처 표기가 부족합니다.",
          suggestedFix: "출처를 붙이세요.",
          dismissedAt: new Date("2026-07-06T01:00:00.000Z"),
          dismissedBy: "owner",
          dismissReason: "Owner reviewed source risk.",
        },
        {
          id: "issue_2",
          complianceCheckId: "check_1",
          issueType: "content_depth_missing",
          severity: "low",
          message: "본문 길이가 짧습니다.",
          suggestedFix: "본문을 보강하세요.",
          dismissedAt: null,
          dismissedBy: null,
          dismissReason: null,
        },
      ],
    } as Parameters<typeof serializeComplianceCheck>[0]);

    expect(check.issues[0]).toMatchObject({
      dismissed: true,
      dismissed_at: "2026-07-06T01:00:00.000Z",
      dismissed_by: "owner",
      dismiss_reason: "Owner reviewed source risk.",
      dismissal: {
        dismissed_at: "2026-07-06T01:00:00.000Z",
        dismissed_by: "owner",
        reason: "Owner reviewed source risk.",
      },
      blocks_export: false,
    });
    expect(check.issues[1]).toMatchObject({
      dismissed: false,
      dismiss_reason: null,
      dismissal: null,
      blocks_export: false,
    });
  });

  it("recomputes export readiness and UI state after medium issue dismissal", () => {
    expect(complianceServiceSource).toContain(
      "const exportAllowed = deriveComplianceCheckExportAllowed(issues)",
    );
    expect(complianceServiceSource).toContain("include: { complianceIssues: true }");
    expect(complianceServiceSource).toContain("currentStatus: updated.contentPackage.status");
    expect(complianceServiceSource).toContain(
      "compliance_check: serializeComplianceCheck(updated.complianceCheck)",
    );
    expect(contentDetailSource).toContain("payload.compliance_check.export_allowed");
    expect(contentDetailSource).toContain("payload.compliance_check.id");
  });

  it("accepts active policy rule context in compliance AI input", () => {
    const input: ComplianceInput = {
      bodyMarkdown: "출처: 제조사\n\n본문",
      hasShoppingConnectLinks: false,
      hasPriceMentions: false,
      policyRules: [
        {
          rule_type: "compliance",
          rule_code: "shopping_connect_disclosure_required",
          description: "쇼핑커넥트 링크가 있으면 대가성 문구가 필요하다.",
        },
      ],
    };

    expect(input.policyRules?.[0]).toMatchObject({
      rule_type: "compliance",
      rule_code: "shopping_connect_disclosure_required",
    });
  });

  it("loads active policy rules and invokes runtime AI semantic review with them", () => {
    for (const source of [
      "prisma.policyRule.findMany",
      "where: { isActive: true }",
      "rule_type: rule.ruleType",
      "rule_code: rule.ruleCode",
      "description: rule.description",
      "createRuntimeAIAdapter()",
      "adapter.checkCompliance({",
      "policyRules: input.policyRules",
    ]) {
      expect(complianceServiceSource).toContain(source);
    }
  });

  it("uses active seeded policy rules in deterministic governance", () => {
    const activeRules = [
      {
        rule_type: "compliance",
        rule_code: "shopping_connect_disclosure_required",
        description: "정책 설명: 쇼핑커넥트 대가성 표시 필수",
      },
      {
        rule_type: "content",
        rule_code: "unused_product_review_forbidden",
        description: "정책 설명: 미사용 상품 후기체 금지",
      },
    ];
    const result = evaluateCompliance({
      body_markdown: "출처: 제조사\n\n직접 사용해 보니 좋았습니다.",
      has_shopping_connect_links: true,
      has_price_mentions: true,
      policy_rules: activeRules,
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue_type: "shopping_connect_disclosure_missing",
          message: "정책 설명: 쇼핑커넥트 대가성 표시 필수",
        }),
        expect.objectContaining({
          issue_type: "unverified_direct_use_claim",
          message: "정책 설명: 미사용 상품 후기체 금지",
        }),
      ]),
    );
    expect(result.issues.map((issue) => issue.issue_type)).toContain("price_notice_missing");
  });

  it("keeps baseline compliance rules active when active policy rules are missing", () => {
    const result = evaluateCompliance({
      body_markdown: "직접 사용해 보니 10,000원에 좋았습니다.",
      has_shopping_connect_links: true,
      has_price_mentions: true,
      policy_rules: [],
    });

    expect(result.risk_level).toBe("high");
    expect(result.export_allowed).toBe(false);
    expect(result.issues.map((issue) => issue.issue_type)).toEqual(
      expect.arrayContaining([
        "shopping_connect_disclosure_missing",
        "price_notice_missing",
        "source_attribution_missing",
        "unverified_direct_use_claim",
      ]),
    );
  });

  it("does not let disabled policy rule descriptions influence active governance", () => {
    const result = evaluateCompliance({
      body_markdown: "출처: 제조사\n\n10,000원입니다.",
      has_shopping_connect_links: false,
      has_price_mentions: true,
      policy_rules: [
        {
          rule_type: "compliance",
          rule_code: "price_checked_at_required",
          description: "활성 정책: 가격 기준일 필수",
        },
      ],
    });

    expect(complianceServiceSource).toContain("where: { isActive: true }");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue_type: "price_notice_missing",
          message: "활성 정책: 가격 기준일 필수",
        }),
      ]),
    );
    expect(result.issues.map((issue) => issue.message)).not.toContain(
      "비활성 정책: 가격 기준일 생략 허용",
    );
  });

  it("merges semantic AI issues additively without removing rule-engine issues", () => {
    const merged = mergeComplianceIssues({
      ruleIssues: [
        {
          issue_type: "shopping_connect_disclosure_missing",
          severity: "high",
          message: "Rule-engine issue",
        },
      ],
      semanticOutput: {
        pass: false,
        risk_level: "medium",
        export_allowed: false,
        issues: [
          {
            type: "claim_context",
            field: "body_markdown",
            severity: "medium",
            message: "Semantic issue",
          },
        ],
      },
    });

    expect(merged.risk_level).toBe("high");
    expect(merged.export_allowed).toBe(false);
    expect(merged.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issue_type: "shopping_connect_disclosure_missing" }),
        expect.objectContaining({ issue_type: "semantic_claim_context", severity: "medium" }),
      ]),
    );
  });

  it("ignores hostile semantic pass output when rule-engine issues block export", () => {
    const merged = mergeComplianceIssues({
      ruleIssues: [
        {
          issue_type: "shopping_connect_disclosure_missing",
          severity: "high",
          message: "Rule-engine issue",
        },
      ],
      semanticOutput: {
        pass: true,
        risk_level: "low",
        export_allowed: true,
        issues: [],
      },
    });

    expect(merged.pass).toBe(false);
    expect(merged.risk_level).toBe("high");
    expect(merged.export_allowed).toBe(false);
    expect(merged.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issue_type: "shopping_connect_disclosure_missing" }),
      ]),
    );
  });

  it("fails closed when semantic AI review is unavailable", () => {
    const merged = mergeComplianceIssues({
      ruleIssues: [],
      semanticOutput: null,
    });

    expect(merged.pass).toBe(false);
    expect(merged.risk_level).toBe("high");
    expect(merged.export_allowed).toBe(false);
    expect(merged.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issue_type: "semantic_review_unavailable",
          severity: "high",
        }),
      ]),
    );
  });
});

describe("P3 export contract", () => {
  const exportInput = {
    title: "자취방 습기 제거 기준",
    body_markdown: "출처: 네이버 쇼핑\n\n본문 <script>alert(1)</script>",
    disclosure_text: "이 글은 쇼핑커넥트 활동을 포함할 수 있습니다.",
    price_notice: "가격은 확인일 기준이며 변동될 수 있습니다.",
  };

  it("renders markdown from title, disclosure, body, and price notice", () => {
    const markdown = renderMarkdownExport(exportInput);

    expect(markdown).toContain("# 자취방 습기 제거 기준");
    expect(markdown).toContain(exportInput.disclosure_text);
    expect(markdown).toContain(exportInput.price_notice);
  });

  it("escapes HTML at the export boundary", () => {
    const html = renderNaverHtmlExport(exportInput);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("style=");
  });

  it("creates markdown, html, copy, and zip bundle records", () => {
    const bundle = createExportBundle(exportInput);

    expect(bundle.map((item) => item.format)).toEqual([
      ExportFormat.markdown,
      ExportFormat.html,
      ExportFormat.copy,
      ExportFormat.zip,
    ]);
  });

  it("includes markdown, html, plain text, and export_manifest.json in the ZIP bundle", () => {
    const bundle = createExportBundle(exportInput, {
      content_package_id: "pkg_1",
      draft_id: "draft_1",
      compliance_check_id: "check_1",
      generated_at: "2026-07-06T00:00:00.000Z",
    });
    const zipRecord = bundle.find((item) => item.format === ExportFormat.zip);
    expect(zipRecord).toBeDefined();

    const zipBuffer = Buffer.from(zipRecord?.content ?? "", "base64");
    const zipText = zipBuffer.toString("utf8");

    expect(zipBuffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(zipText).toContain("post.md");
    expect(zipText).toContain("post.html");
    expect(zipText).toContain("post.txt");
    expect(zipText).toContain("export_manifest.json");
    expect(zipText).toContain('"content_package_id": "pkg_1"');
    expect(zipText).toContain('"draft_id": "draft_1"');
    expect(zipText).toContain('"compliance_check_id": "check_1"');
    expect(zipText).toContain('"formats": [');
    expect(zipText).toContain('"manual_publish_required": true');
  });

  it("creates explicit manual-publish export manifests", () => {
    expect(
      createExportManifest({
        content_package_id: "pkg_1",
        draft_id: "draft_1",
        compliance_check_id: "check_1",
        generated_at: "2026-07-06T00:00:00.000Z",
      }),
    ).toMatchObject({
      publish_mode: "manual",
      auto_publish: false,
      manual_publish_required: true,
    });
  });

  it("persists export audit and storage metadata from draft and compliance sources", () => {
    for (const source of [
      "draftId: draft.id",
      "complianceCheckId: latestCheck.id",
      "channel: draft.channel",
      "storageKey:",
      "bundleFilename",
      "byteSize: byteSizeForExport(item.format, item.content)",
      "checksumSha256: checksumSha256(item.format, item.content)",
      "manifestJson: manifest",
    ]) {
      expect(exportServiceSource).toContain(source);
    }

    for (const schemaField of [
      'draftId           String?          @map("draft_id")',
      'complianceCheckId String?          @map("compliance_check_id")',
      'storageKey        String?          @map("storage_key")',
      'bundleFilename    String?          @map("bundle_filename")',
      'byteSize          Int?             @map("byte_size")',
      'checksumSha256    String?          @map("checksum_sha256")',
      'manifestJson      Json?            @map("manifest_json")',
    ]) {
      expect(prismaSchemaSource).toContain(schemaField);
    }
  });

  it("rejects malformed or unknown export request bodies before mutating export state", () => {
    expect(exportRouteSource).toContain("request.text()");
    expect(exportRouteSource).toContain("JSON.parse(bodyText)");
    expect(exportRouteSource).not.toContain("catch(() => ({}))");
    expect(exportServiceSource).toContain("z.object({}).strict()");
  });

  it("keeps deterministic migration SQL present for export governance metadata", () => {
    expect(initialMigrationSource).toContain('CREATE TYPE "ExportFormat"');
    expect(initialMigrationSource).toContain('CREATE TABLE "exports"');
    expect(initialMigrationSource).toContain('"draft_id" TEXT');
    expect(initialMigrationSource).toContain('"compliance_check_id" TEXT');
    expect(initialMigrationSource).toContain('"storage_key" TEXT');
    expect(initialMigrationSource).toContain('"bundle_filename" TEXT');
    expect(initialMigrationSource).toContain('"byte_size" INTEGER');
    expect(initialMigrationSource).toContain('"checksum_sha256" TEXT');
    expect(initialMigrationSource).toContain('"manifest_json" JSONB');
  });

  it("plans retention cleanup as a conservative dry run before deleting artifacts", () => {
    const plan = buildRetentionCleanupPlan({
      mode: "dry-run",
      now: new Date("2026-07-06T00:00:00.000Z"),
    });

    expect(plan.mode).toBe("dry-run");
    expect(plan.cutoffs.exports.toISOString()).toBe("2026-04-07T00:00:00.000Z");
    expect(plan.cutoffs.resolved_errors.toISOString()).toBe("2026-06-06T00:00:00.000Z");
    expect(plan.cutoffs.cost_logs.toISOString()).toBe("2026-01-07T00:00:00.000Z");
    expect(plan.cutoffs.raw_items.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(plan.cutoffs.agent_runs.toISOString()).toBe("2026-06-06T00:00:00.000Z");
    expect(plan.cutoffs.triggered_agent_runs.toISOString()).toBe("2026-04-07T00:00:00.000Z");
    expect(plan.deleted).toEqual({
      exports: 0,
      resolved_errors: 0,
      cost_logs: 0,
      raw_items: 0,
      agent_runs: 0,
    });
    expect(plan.skipped).toEqual({
      exports: 0,
      resolved_errors: 0,
      cost_logs: 0,
      raw_items: 0,
      agent_runs: 0,
    });
    expect(retentionServiceSource).toContain('if (input.mode === "dry-run")');
    expect(retentionServiceSource).toContain("resolvedAt: { not: null }");
    expect(retentionServiceSource).toContain('if (input.mode !== "execute")');
    expect(retentionServiceSource).toContain("validateRetentionCleanupInput(input)");
    expect(() =>
      buildRetentionCleanupPlan({
        mode: "preview" as "dry-run",
        now: new Date("2026-07-06T00:00:00.000Z"),
      }),
    ).toThrow("Unsupported retention cleanup mode");
    expect(() =>
      buildRetentionCleanupPlan({
        mode: "dry-run",
        exportDays: 0,
      }),
    ).toThrow("positive integer day window");
  });
});
