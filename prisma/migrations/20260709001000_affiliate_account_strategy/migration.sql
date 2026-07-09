ALTER TABLE "affiliate_accounts"
ADD COLUMN "category_focus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sns_targets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hook_style" TEXT;
