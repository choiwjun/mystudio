export type DetailDraft = {
  readonly id: string;
  readonly channel: string;
  readonly homefeed_title: readonly string[];
  readonly search_title: string | null;
  readonly thumbnail_text: readonly string[];
  readonly first_screen: string | null;
  readonly body_markdown: string | null;
  readonly comparison_table: string | null;
  readonly faq: readonly DetailFaqItem[] | null;
  readonly disclosure_text: string | null;
  readonly price_notice: string | null;
  readonly original_body: string | null;
  readonly updated_at: string;
  readonly status?: string;
};

export type DetailFaqItem = {
  readonly question: string;
  readonly answer: string;
};

export type DetailComplianceIssue = {
  readonly id: string;
  readonly issue_type: string;
  readonly severity: "low" | "medium" | "high";
  readonly message: string;
  readonly suggested_fix: string | null;
  readonly blocks_export?: boolean;
  readonly dismissed?: boolean;
  readonly dismissed_at?: string | null;
  readonly dismissed_by?: string | null;
  readonly dismiss_reason?: string | null;
  readonly dismissal?: {
    readonly dismissed_at: string;
    readonly dismissed_by: string | null;
    readonly reason: string | null;
  } | null;
};

export type DetailTitleCandidate = {
  readonly id?: string;
  readonly kind: "homefeed" | "search" | "thumbnail";
  readonly text: string;
  readonly hook_type?: string | null;
  readonly hookType?: string | null;
  readonly selected: boolean;
};

export type DetailComplianceCheck = {
  readonly id: string;
  readonly risk_level: string;
  readonly pass: boolean;
  readonly export_allowed: boolean;
  readonly issues: readonly DetailComplianceIssue[];
};

export type DetailShoppingConnectLink = {
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

export type DetailSnsVariant = {
  readonly id: string;
  readonly platform: string;
  readonly format: string;
  readonly hook: string | null;
  readonly body: string;
  readonly cta: string | null;
  readonly hashtags: readonly string[];
  readonly score: number | null;
  readonly created_at: string;
};

export type DetailContentPackage = {
  readonly id: string;
  readonly topic: {
    readonly title: string;
    readonly description: string | null;
  };
  readonly opportunity_memo: {
    readonly why_now: string;
    readonly homefeed_angle: string;
    readonly search_angle: string;
    readonly keyword_clusters: readonly {
      readonly primary_keyword: string;
      readonly related_keywords: readonly string[];
      readonly search_volume: number | null;
      readonly competition_score: number | null;
    }[];
  } | null;
  readonly status: string;
  readonly paperclip_decision_id: string;
  readonly drafts: readonly DetailDraft[];
  readonly compliance_checks: readonly DetailComplianceCheck[];
  readonly products: readonly {
    readonly id: string;
    readonly product_name: string;
    readonly price: number | null;
    readonly price_checked_at: string | null;
  }[];
  readonly title_candidates: readonly DetailTitleCandidate[];
  readonly shopping_connect_links: readonly DetailShoppingConnectLink[];
  readonly sns_variants: readonly DetailSnsVariant[];
  readonly exports: readonly DetailExportRecord[];
};

export type DetailExportRecord = {
  readonly id: string;
  readonly format: "markdown" | "html" | "copy" | "zip";
  readonly content?: string;
  readonly created_at: string;
};
