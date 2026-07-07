export type ProductTab = "registered" | "new" | "refresh";

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
