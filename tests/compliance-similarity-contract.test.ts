import { describe, expect, it } from "vitest";
import { competitorSimilarityIssuesFromRows } from "@/lib/compliance/similarity";

describe("competitor similarity compliance contract", () => {
  it("flags exact competitor title reuse in a blog draft", () => {
    const issues = competitorSimilarityIssuesFromRows({
      bodyMarkdown: "## 자취방 습기 잡는 현실적인 순서\n환기, 제습, 흡습제를 비교해서 정리합니다.",
      rows: [
        {
          title: "자취방 습기 잡는 현실적인 순서",
          url: "https://blog.naver.com/example/1",
          content: "환기와 제습 순서를 비교합니다.",
        },
      ],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      issue_type: "competitor_similarity_risk",
      severity: "medium",
    });
  });

  it("does not flag pattern-only rewrites that avoid copied phrasing", () => {
    const issues = competitorSimilarityIssuesFromRows({
      bodyMarkdown:
        "## 장마철 원룸 습기 줄이는 체크리스트\n먼저 환기 가능 시간과 제습 도구 예산을 나눠 봅니다.",
      rows: [
        {
          title: "자취방 습기 잡는 현실적인 순서",
          url: "https://blog.naver.com/example/1",
          content: "환기와 제습 순서를 비교합니다.",
        },
      ],
    });

    expect(issues).toEqual([]);
  });
});
