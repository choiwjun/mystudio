import { z } from "zod";

export const productSchema = z.object({
  id: z.string().min(1),
  product_name: z.string().min(1),
  product_url: z.string(),
  source: z.string(),
  price: z.number().int().nonnegative().nullable(),
  price_checked_at: z.string().nullable(),
  image_url: z.string().nullable().optional(),
  category: z.string().nullable(),
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

export const productDeleteResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ deleted: z.literal(true) }),
});
