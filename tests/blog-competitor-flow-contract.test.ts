import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const generationContextSource = readFileSync("lib/content/generationContext.ts", "utf8");
const competitorBenchmarkSource = readFileSync("lib/content/competitorBenchmark.ts", "utf8");

describe("blog competitor benchmark flow contract", () => {
  it("loads Naver blog raw items only for blog draft generation", () => {
    expect(generationContextSource).toContain('input.task === "generateBlogDraft"');
    expect(generationContextSource).toContain("loadCompetitorBenchmarkContext(input.topic)");
    expect(competitorBenchmarkSource).toContain('itemType: "naver_blog"');
    expect(competitorBenchmarkSource).toContain('source: "naver_blog_raw_items"');
  });

  it("turns competitor content into originality-guarded pattern context", () => {
    expect(competitorBenchmarkSource).toContain("patternSummary(row)");
    expect(competitorBenchmarkSource).toContain("originalityGuard(row)");
    expect(competitorBenchmarkSource).toContain("제목, 문단 순서, 고유 표현을 재사용하지 않는다");
  });
});
