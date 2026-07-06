import { readFileSync } from "node:fs";
import { ExportFormat } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  emptyContentPackageDetail,
  isExplicitDemoPackageId,
} from "@/components/content/ContentPackageDetail";
import { demoContentPackage } from "@/components/content/demoPackage";
import { AIOutputValidationError, parseBlogDraftOutput } from "@/lib/ai/adapter";
import { applyComplianceFixes, evaluateCompliance } from "@/lib/compliance/rules";
import {
  deriveComplianceCheckExportAllowed,
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
const complianceServiceSource = readFileSync("lib/compliance/service.ts", "utf8");
const exportServiceSource = readFileSync("lib/export/service.ts", "utf8");
const exportRouteSource = readFileSync("app/api/content-packages/[id]/export/route.ts", "utf8");
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
    expect(exportServiceSource).toContain("exportTransitionStatuses");
    expect(exportServiceSource).toContain("Math.max(input.currentProgress ?? 0, 0.9)");
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
    expect(plan.deleted).toEqual({ exports: 0, resolved_errors: 0, cost_logs: 0 });
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
