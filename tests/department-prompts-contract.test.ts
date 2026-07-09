import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProviderPrompt, providerSystemPrompt } from "@/lib/ai/departmentPrompts";

const providerAdaptersSource = readFileSync("lib/ai/providerAdapters.ts", "utf8");
const seedSource = readFileSync("prisma/seed.ts", "utf8");
const departmentPromptsSource = readFileSync("lib/ai/departmentPrompts.ts", "utf8");

describe("department prompt contract", () => {
  it("connects OpenAI and Claude provider calls to department-level prompts", () => {
    expect(providerAdaptersSource).toContain("providerSystemPrompt()");
    expect(providerAdaptersSource).toContain("buildProviderPrompt(task, input)");
    expect(departmentPromptsSource).toContain("Naver Blog Desk");
    expect(departmentPromptsSource).toContain("Search Desk");
    expect(departmentPromptsSource).toContain("Social Desk");
    expect(departmentPromptsSource).toContain("Compliance Desk");
    expect(departmentPromptsSource).toContain("Paperclip HQ");
  });

  it("builds a Korean commerce writing prompt with template and playbook context", () => {
    const prompt = buildProviderPrompt("generateBlogDraft", {
      topic: "장마철 자취방 습기",
      products: [],
      companyProfile: { companyName: "Paperclip Company" },
      generationContext: {
        promptTemplate: {
          name: "blog_draft_generation",
          version: 1,
          template: "문제-기준-비교-주의사항-CTA 순서로 작성한다.",
        },
        categoryPlaybooks: [
          {
            category: "자취",
            homefeedToneGuidance: "혼자 사는 사람의 불편을 먼저 짚는다.",
            searchGuidance: "공간 크기와 예산을 비교한다.",
            productRecommendations: ["소형 제습기"],
            commonMistakes: ["직접 써본 듯한 후기체"],
            winningPatterns: ["문제-기준-비교"],
          },
        ],
        competitorBenchmark: {
          source: "naver_blog_raw_items",
          query: "장마철 자취방 습기",
          patterns: [
            {
              title: "자취방 습기 잡는 현실적인 순서",
              url: "https://blog.naver.com/example/1",
              snippet: "환기와 제습 순서를 비교합니다.",
              patternSummary: "문제 공감 후 체크리스트를 제시한다.",
              originalityGuard: "제목, 문단 순서, 표현을 재사용하지 않는다.",
            },
          ],
        },
      },
    });

    expect(providerSystemPrompt()).toContain("Korean commerce content system");
    expect(prompt).toContain("Department: Naver Blog Desk");
    expect(prompt).toContain("Active prompt template: blog_draft_generation v1");
    expect(prompt).toContain("문제-기준-비교-주의사항-CTA");
    expect(prompt).toContain("Category playbook: 자취");
    expect(prompt).toContain("Competitor benchmark source: naver_blog_raw_items");
    expect(prompt).toContain("제목, 문단 순서, 표현을 재사용하지 않는다.");
    expect(prompt).toContain("직접 써본 척하지");
    expect(prompt).toContain("Do not copy competitor titles");
    expect(prompt).toContain("Never invent product usage");
  });

  it("seeds default writing prompt templates and category playbooks", () => {
    for (const expected of [
      "blog_draft_generation",
      "search_structure_generation",
      "sns_variant_generation",
      "naver_clip_script_generation",
      "playbook_living_alone_v1",
      "playbook_seasonal_v1",
      "playbook_cleaning_v1",
    ]) {
      expect(seedSource).toContain(expected);
    }
  });

  it("builds affiliate-safe SNS hooks for Social Desk variants", () => {
    const prompt = buildProviderPrompt("generateSNSVariant", {
      topic: "원룸 습기 줄이는 생활템",
      products: [{ product_name: "원룸 제습제", commission_rate: 7 }],
      companyProfile: { companyName: "Paperclip Company" },
      sourceDraftMarkdown:
        "원룸 생활에서 습기를 줄이려면 환기 시간, 제습제 위치, 가격 기준일을 함께 확인해야 합니다.",
    });

    expect(prompt).toContain("Department: Social Desk");
    expect(prompt).toContain("3초 안에 멈춰 세우는");
    expect(prompt).toContain("PAS");
    expect(prompt).toContain("제휴");
    expect(prompt).toContain("과장된 수익·효능 표현");
    expect(prompt).toContain("platform one of instagram, threads, x");
  });
});
