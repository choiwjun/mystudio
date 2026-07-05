import type { DetailContentPackage } from "@/components/content/types";

export const demoContentPackage: DetailContentPackage = {
  id: "demo",
  topic: {
    title: "장마철 자취방 습기 관리",
    description: "계절성 문제와 쇼핑 연결 가능성이 높은 콘텐츠 패키지입니다.",
  },
  opportunity_memo: {
    why_now: "장마 시즌과 원룸 생활 관심사가 겹쳐 홈피드 공감도가 높습니다.",
    homefeed_angle: "문제 공감형 첫 화면",
    search_angle: "체크리스트형 검색 구조",
    keyword_clusters: [
      {
        primary_keyword: "자취방 습기 제거",
        related_keywords: ["장마 습기", "원룸 제습", "곰팡이 예방"],
        search_volume: 1200,
        competition_score: 42,
      },
      {
        primary_keyword: "소형 제습기 추천",
        related_keywords: ["제습기 가격", "원룸 제습기", "장마철 제습"],
        search_volume: 980,
        competition_score: 51,
      },
    ],
  },
  status: "owner_approval_required",
  paperclip_decision_id: "demo_decision",
  drafts: [
    {
      id: "demo_draft",
      channel: "naver_blog",
      homefeed_title: ["장마철 자취방 습기, 지금 놓치면 후회하는 이유"],
      search_title: "자취방 습기 제거 기준과 소형 제습기 체크리스트",
      thumbnail_text: ["오늘 바로 점검", "실패 줄이는 기준"],
      first_screen: "장마철에는 습기 문제가 곰팡이와 냄새로 이어지기 전에 먼저 잡아야 합니다.",
      body_markdown:
        "출처: 네이버 쇼핑 검색 결과와 상품 상세 정보를 기준으로 정리했습니다.\n\n장마철 자취방 습기는 먼저 환기, 흡습, 제습 순서로 점검합니다.\n\n가격은 확인일 기준이며 변동될 수 있습니다.",
      comparison_table: "| 기준 | 확인 |\n| --- | --- |\n| 가격 | 기준일 필요 |",
      disclosure_text: "이 글은 쇼핑커넥트 활동을 포함할 수 있습니다.",
      price_notice: "가격은 확인일 기준이며 변동될 수 있습니다.",
      original_body:
        "출처: 네이버 쇼핑 검색 결과와 상품 상세 정보를 기준으로 정리했습니다.\n\n장마철 자취방 습기는 먼저 환기, 흡습, 제습 순서로 점검합니다.\n\n가격은 확인일 기준이며 변동될 수 있습니다.",
      updated_at: "2026-07-05T00:00:00.000Z",
    },
  ],
  compliance_checks: [
    {
      id: "demo_check",
      risk_level: "low",
      pass: true,
      export_allowed: true,
      issues: [],
    },
  ],
  products: [
    {
      id: "demo_product",
      product_name: "소형 제습기",
      price: 59000,
      price_checked_at: "2026-07-05T00:00:00.000Z",
    },
  ],
};

export const highRiskDemoContentPackage: DetailContentPackage = {
  ...demoContentPackage,
  id: "high-risk-demo",
  status: "compliance_failed",
  compliance_checks: [
    {
      id: "demo_high_risk_check",
      risk_level: "high",
      pass: false,
      export_allowed: false,
      issues: [
        {
          id: "demo_high_risk_issue",
          issue_type: "shopping_connect_disclosure_missing",
          severity: "high",
          message: "쇼핑커넥트 링크가 있지만 대가성 문구가 없습니다.",
          suggested_fix: "본문 상단에 쇼핑커넥트 대가성 문구를 추가하세요.",
        },
      ],
    },
  ],
};

export function demoPackageForId(packageId: string): DetailContentPackage {
  return packageId === "high-risk-demo" ? highRiskDemoContentPackage : demoContentPackage;
}
