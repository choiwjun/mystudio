import { ExportFormat } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AIOutputValidationError, parseBlogDraftOutput } from "@/lib/ai/adapter";
import { applyComplianceFixes, evaluateCompliance } from "@/lib/compliance/rules";
import {
  createHomefeedTitleCandidates,
  createThumbnailCandidates,
  hasFullHookCoverage,
} from "@/lib/content/titleCandidates";
import {
  createExportBundle,
  renderMarkdownExport,
  renderNaverHtmlExport,
} from "@/lib/export/render";

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
});
