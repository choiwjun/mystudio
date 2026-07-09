import type {
  AffiliateAccountFormValues,
  AffiliateAccountPlatform,
  AffiliateAccountStatus,
} from "@/components/products/types";

export const affiliateAccountStatusLabels: Record<AffiliateAccountStatus, string> = {
  active: "운영중",
  setup_needed: "신청/연결 필요",
  paused: "일시중지",
};

export const affiliateAccountPlatformLabels: Record<AffiliateAccountPlatform, string> = {
  naver_blog: "네이버 블로그",
  shopping_connect: "쇼핑커넥트",
  instagram: "인스타그램",
  threads: "스레드",
  x: "X",
  youtube: "유튜브",
  coupang: "쿠팡 파트너스",
  musinsa: "무신사",
  oliveyoung: "올리브영",
  other: "기타",
};

export const emptyAffiliateAccountForm: AffiliateAccountFormValues = {
  platform: "shopping_connect",
  account_name: "",
  channel_url: "",
  affiliate_program: "네이버 쇼핑커넥트",
  disclosure_policy: "대가성 문구 상단 표기",
  category_focus: "생활, 쇼핑",
  sns_targets: ["instagram", "threads"],
  hook_style: "문제공감형",
  status: "setup_needed",
  memo: "",
};

export function parseAffiliateAccountPlatform(value: string): AffiliateAccountPlatform {
  switch (value) {
    case "naver_blog":
    case "shopping_connect":
    case "instagram":
    case "threads":
    case "x":
    case "youtube":
    case "coupang":
    case "musinsa":
    case "oliveyoung":
    case "other":
      return value;
    default:
      return "other";
  }
}

export function parseAffiliateAccountStatus(value: string): AffiliateAccountStatus {
  switch (value) {
    case "active":
    case "setup_needed":
    case "paused":
      return value;
    default:
      return "setup_needed";
  }
}
