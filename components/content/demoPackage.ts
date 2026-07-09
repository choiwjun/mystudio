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
      faq: [
        {
          question: "언제 가격을 다시 확인하나요?",
          answer: "게시 전과 7일 경과 시 다시 확인합니다.",
        },
        { question: "자동 게시되나요?", answer: "아니요. 검수와 승인 후 수동 게시합니다." },
        {
          question: "쇼핑커넥트 표기는 필수인가요?",
          answer: "링크가 있으면 대가성 문구를 반드시 표시합니다.",
        },
      ],
      disclosure_text: "이 글은 쇼핑커넥트 활동을 포함할 수 있습니다.",
      price_notice: "가격은 확인일 기준이며 변동될 수 있습니다.",
      original_body:
        "출처: 네이버 쇼핑 검색 결과와 상품 상세 정보를 기준으로 정리했습니다.\n\n장마철 자취방 습기는 먼저 환기, 흡습, 제습 순서로 점검합니다.\n\n가격은 확인일 기준이며 변동될 수 있습니다.",
      updated_at: "2026-07-05T00:00:00.000Z",
      status: "ready",
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
  title_candidates: [
    {
      id: "demo_title_candidate",
      kind: "homefeed",
      text: "장마철 자취방 습기, 지금 놓치면 후회하는 이유",
      hook_type: "problem_empathy",
      selected: true,
    },
  ],
  shopping_connect_links: [
    {
      id: "demo_link",
      product_id: "demo_product",
      content_package_id: "demo",
      shopping_connect_url: "https://shopping.example/demo",
      commission_rate: 3.5,
      bonus_commission: null,
      link_checked_at: "2026-07-05T00:00:00.000Z",
      is_active: true,
      notes: "본문 비교표 하단 배치 후보",
      stale: false,
    },
  ],
  sns_variants: [
    {
      id: "demo_clip",
      platform: "naver_clip",
      format: "copy",
      hook: "장마철 자취방 습기, 30초 점검",
      body: "0-2초: 장마철 냄새와 곰팡이, 시작은 습기입니다.\n3-20초: 환기, 흡습, 제습 순서로 체크합니다.\n20-30초: 자세한 비교 기준은 블로그 표에서 확인하세요.",
      cta: "자세한 비교는 블로그에서 확인하세요.",
      hashtags: ["#네이버클립", "#자취방습기", "#제습체크"],
      score: 72,
      created_at: "2026-07-05T00:00:00.000Z",
    },
    {
      id: "demo_instagram",
      platform: "instagram",
      format: "carousel_6",
      hook: "습기 잡기 전에 먼저 버릴 기준",
      body: "장마철 자취방은 환기만으로 해결되지 않는 날이 많습니다. 가격보다 먼저 공간 크기와 배수 편의성을 보세요.",
      cta: "저장해두고 게시 전 가격 기준일을 다시 확인하세요.",
      hashtags: ["#자취방", "#장마철", "#쇼핑체크"],
      score: 74,
      created_at: "2026-07-05T00:00:00.000Z",
    },
  ],
  exports: [
    {
      id: "demo_export",
      format: "markdown",
      created_at: "2026-07-05T00:00:00.000Z",
    },
  ],
};
