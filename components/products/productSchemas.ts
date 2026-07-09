import { z } from "zod";
import { affiliateAccountPlatforms } from "@/components/products/types";

export const productSchema = z.object({
  id: z.string().min(1),
  product_name: z.string().min(1),
  product_url: z.string(),
  source: z.string(),
  price: z.number().int().nonnegative().nullable(),
  price_checked_at: z.string().nullable(),
  image_url: z.string().nullable().optional(),
  category: z.string().nullable(),
  popularity_score: z.number().nullable(),
  popularity_rank: z.number().int().positive().nullable(),
  popularity_source: z.string().nullable(),
  popularity_checked_at: z.string().nullable(),
  memo: z.string().nullable(),
  stale: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export const contentPackageSummarySchema = z.object({
  id: z.string().min(1),
  topic: z.object({
    title: z.string().min(1),
  }),
  status: z.string().min(1),
});

export const shoppingConnectLinkSchema = z.object({
  id: z.string().min(1),
  product_id: z.string().min(1),
  content_package_id: z.string().nullable(),
  shopping_connect_url: z.string().min(1),
  commission_rate: z.number().nonnegative(),
  bonus_commission: z.number().nullable(),
  link_checked_at: z.string().nullable(),
  is_active: z.boolean(),
  notes: z.string().nullable(),
  stale: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const sessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ csrf_token: z.string().min(1) }),
});

export const productListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ products: z.array(productSchema) }),
});

export const productMutationResponseSchema = z.object({
  success: z.literal(true),
  data: productSchema,
});
export const contentPackageListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ content_packages: z.array(contentPackageSummarySchema) }),
});

export const shoppingConnectLinkListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ shopping_connect_links: z.array(shoppingConnectLinkSchema) }),
});

export const shoppingConnectLinkMutationResponseSchema = z.object({
  success: z.literal(true),
  data: shoppingConnectLinkSchema,
});

export const affiliateAccountSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(affiliateAccountPlatforms),
  account_name: z.string(),
  channel_url: z.string(),
  affiliate_program: z.string(),
  disclosure_policy: z.string(),
  category_focus: z.array(z.string()),
  sns_targets: z.array(z.string()),
  hook_style: z.string(),
  status: z.enum(["active", "setup_needed", "paused"]),
  memo: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const affiliateAccountListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ affiliate_accounts: z.array(affiliateAccountSchema) }),
});

export const affiliateAccountMutationResponseSchema = z.object({
  success: z.literal(true),
  data: affiliateAccountSchema,
});

export const affiliateAccountContentPlanResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    content_plan: z.object({
      account_id: z.string(),
      account_name: z.string(),
      sns_targets: z.array(z.string()),
      selected_product: z
        .object({
          product_id: z.string(),
          product_name: z.string(),
          category: z.string().nullable(),
          affiliate_url: z.string(),
          popularity_source: z.string().nullable(),
          score: z.number(),
        })
        .nullable(),
      hook_ment: z.string(),
      reasons: z.array(z.string()),
    }),
  }),
});

export const affiliateLinkSchema = z.object({
  id: z.string().min(1),
  account_id: z.string().nullable(),
  product_id: z.string().nullable(),
  content_package_id: z.string().nullable(),
  platform: z.enum(affiliateAccountPlatforms),
  program: z.string(),
  destination_url: z.string(),
  affiliate_url: z.string(),
  commission_rate: z.number().nonnegative(),
  disclosure_policy: z.string(),
  placement_guide: z.string().nullable(),
  is_active: z.boolean(),
  link_checked_at: z.string().nullable(),
  notes: z.string().nullable(),
  stale: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const affiliateLinkListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ affiliate_links: z.array(affiliateLinkSchema) }),
});

export const affiliateLinkMutationResponseSchema = z.object({
  success: z.literal(true),
  data: affiliateLinkSchema,
});

export const productDeleteResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ deleted: z.literal(true) }),
});
