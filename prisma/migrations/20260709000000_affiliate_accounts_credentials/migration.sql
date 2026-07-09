CREATE TABLE "affiliate_accounts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "platform" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "channel_url" TEXT,
    "affiliate_program" TEXT NOT NULL,
    "disclosure_policy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'setup_needed',
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "account_id" TEXT,
    "product_id" TEXT,
    "content_package_id" TEXT,
    "platform" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "affiliate_url" TEXT NOT NULL,
    "commission_rate" DOUBLE PRECISION,
    "disclosure_policy" TEXT,
    "placement_guide" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "link_checked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "affiliate_accounts_workspace_id_platform_idx" ON "affiliate_accounts"("workspace_id", "platform");
CREATE INDEX "affiliate_links_account_id_platform_idx" ON "affiliate_links"("account_id", "platform");
CREATE INDEX "affiliate_links_product_id_content_package_id_idx" ON "affiliate_links"("product_id", "content_package_id");
CREATE INDEX "api_credentials_provider_status_idx" ON "api_credentials"("provider", "status");

ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "affiliate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
