export type DetailDraft = {
  readonly id: string;
  readonly channel: string;
  readonly homefeed_title: readonly string[];
  readonly search_title: string | null;
  readonly thumbnail_text: readonly string[];
  readonly first_screen: string | null;
  readonly body_markdown: string | null;
  readonly comparison_table: string | null;
  readonly disclosure_text: string | null;
  readonly price_notice: string | null;
  readonly original_body: string | null;
  readonly updated_at: string;
};

export type DetailComplianceIssue = {
  readonly id: string;
  readonly issue_type: string;
  readonly severity: "low" | "medium" | "high";
  readonly message: string;
  readonly suggested_fix: string | null;
  readonly dismissed_at?: string | null;
};

export type DetailComplianceCheck = {
  readonly id: string;
  readonly risk_level: string;
  readonly pass: boolean;
  readonly export_allowed: boolean;
  readonly issues: readonly DetailComplianceIssue[];
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
};

export type DetailExportRecord = {
  readonly id: string;
  readonly format: "markdown" | "html" | "copy" | "zip";
  readonly content: string;
  readonly created_at: string;
};
