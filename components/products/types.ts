export type ProductTab = "registered" | "new" | "refresh" | "accounts" | "affiliate_links";

export const affiliateAccountPlatforms = [
  "naver_blog",
  "shopping_connect",
  "instagram",
  "threads",
  "x",
  "youtube",
  "coupang",
  "musinsa",
  "oliveyoung",
  "other",
] as const;

export type AffiliateAccountPlatform = (typeof affiliateAccountPlatforms)[number];
export type AffiliateAccountStatus = "active" | "setup_needed" | "paused";

export type AffiliateAccount = {
  readonly id: string;
  readonly platform: AffiliateAccountPlatform;
  readonly account_name: string;
  readonly channel_url: string;
  readonly affiliate_program: string;
  readonly disclosure_policy: string;
  readonly category_focus: readonly string[];
  readonly sns_targets: readonly string[];
  readonly hook_style: string;
  readonly status: AffiliateAccountStatus;
  readonly memo: string;
  readonly created_at?: string | undefined;
  readonly updated_at?: string | undefined;
};

export type AffiliateAccountFormValues = {
  readonly platform: AffiliateAccountPlatform;
  readonly account_name: string;
  readonly channel_url: string;
  readonly affiliate_program: string;
  readonly disclosure_policy: string;
  readonly category_focus: string;
  readonly sns_targets: readonly string[];
  readonly hook_style: string;
  readonly status: AffiliateAccountStatus;
  readonly memo: string;
};

export type AffiliateLink = {
  readonly id: string;
  readonly account_id: string | null;
  readonly product_id: string | null;
  readonly content_package_id: string | null;
  readonly platform: AffiliateAccountPlatform;
  readonly program: string;
  readonly destination_url: string;
  readonly affiliate_url: string;
  readonly commission_rate: number;
  readonly disclosure_policy: string;
  readonly placement_guide: string | null;
  readonly is_active: boolean;
  readonly link_checked_at: string | null;
  readonly notes: string | null;
  readonly stale: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type AffiliateLinkFormValues = {
  readonly account_id: string;
  readonly product_id: string;
  readonly content_package_id: string;
  readonly platform: AffiliateAccountPlatform;
  readonly program: string;
  readonly destination_url: string;
  readonly affiliate_url: string;
  readonly commission_rate: string;
  readonly disclosure_policy: string;
  readonly placement_guide: string;
  readonly notes: string;
};

export type ContentPackageSummary = {
  readonly id: string;
  readonly topic: {
    readonly title: string;
  };
  readonly status: string;
};

export type Product = {
  readonly id: string;
  readonly product_name: string;
  readonly product_url: string;
  readonly source: string;
  readonly price: number | null;
  readonly price_checked_at: string | null;
  readonly image_url?: string | null | undefined;
  readonly category: string | null;
  readonly popularity_score: number | null;
  readonly popularity_rank: number | null;
  readonly popularity_source: string | null;
  readonly popularity_checked_at: string | null;
  readonly memo: string | null;
  readonly stale: boolean;
  readonly created_at?: string | undefined;
  readonly updated_at?: string | undefined;
};

export type ProductFormValues = {
  readonly product_name: string;
  readonly price: string;
  readonly category: string;
  readonly memo: string;
  readonly product_url: string;
  readonly image_url: string;
  readonly source: string;
};
export type ShoppingConnectLinkFormValues = {
  readonly product_id: string;
  readonly content_package_id: string;
  readonly shopping_connect_url: string;
  readonly commission_rate: string;
  readonly notes: string;
};

export type ShoppingConnectLink = {
  readonly id: string;
  readonly product_id: string;
  readonly content_package_id: string | null;
  readonly shopping_connect_url: string;
  readonly commission_rate: number;
  readonly bonus_commission: number | null;
  readonly link_checked_at: string | null;
  readonly is_active: boolean;
  readonly notes: string | null;
  readonly stale: boolean;
};
