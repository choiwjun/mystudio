import { Prisma, type Product, type ShoppingConnectLink } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  type InsaneSearchFailureReason,
  importProductWithInsaneSearch,
} from "@/lib/products/insaneSearch";
import { validateProductImportUrl } from "@/lib/security/productImport";

const productNameMaxLength = 160;
const productSourceMaxLength = 80;
const productUrlMaxLength = 2048;
const productCategoryMaxLength = 80;
const productMemoMaxLength = 500;
const popularitySourceMaxLength = 80;

function hasAllowedUrlProtocol(value: string, protocols: readonly string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const optionalProductUrlSchema = z
  .string()
  .trim()
  .max(productUrlMaxLength)
  .refine((value) => hasAllowedUrlProtocol(value, ["http:", "https:", "manual:"]))
  .optional();

const optionalImageUrlSchema = z
  .string()
  .trim()
  .max(productUrlMaxLength)
  .refine((value) => hasAllowedUrlProtocol(value, ["http:", "https:"]))
  .optional();

export const productCreateSchema = z.object({
  product_name: z.string().trim().min(1).max(productNameMaxLength),
  product_url: optionalProductUrlSchema,
  source: z.string().trim().min(1).max(productSourceMaxLength).optional(),
  price: z.number().int().nonnegative().optional(),
  image_url: optionalImageUrlSchema,
  category: z.string().trim().max(productCategoryMaxLength).optional(),
  popularity_score: z.number().nonnegative().optional(),
  popularity_rank: z.number().int().positive().optional(),
  popularity_source: z.string().trim().max(popularitySourceMaxLength).optional(),
  memo: z.string().trim().max(productMemoMaxLength).optional(),
});

export const productPatchSchema = productCreateSchema.partial();

export const productImportSchema = z.object({
  url: z.string().trim().min(1).max(productUrlMaxLength),
});

export const shoppingConnectLinkCreateSchema = z.object({
  product_id: z.string().min(1),
  content_package_id: z.string().min(1).optional(),
  shopping_connect_url: z.string().url(),
  commission_rate: z.number().nonnegative(),
  bonus_commission: z.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

export const shoppingConnectLinkPatchSchema = shoppingConnectLinkCreateSchema.partial().extend({
  content_package_id: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
  mark_checked: z.boolean().optional(),
});

export type SerializedProduct = {
  readonly id: string;
  readonly product_name: string;
  readonly product_url: string;
  readonly source: string;
  readonly price: number | null;
  readonly price_checked_at: string | null;
  readonly image_url: string | null;
  readonly category: string | null;
  readonly popularity_score: number | null;
  readonly popularity_rank: number | null;
  readonly popularity_source: string | null;
  readonly popularity_checked_at: string | null;
  readonly memo: string | null;
  readonly stale: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type SerializedShoppingConnectLink = {
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
  readonly created_at: string;
  readonly updated_at: string;
};

export function isOlderThanSevenDays(date: Date | null, now = new Date()): boolean {
  if (date === null) {
    return true;
  }
  return now.getTime() - date.getTime() > 7 * 24 * 60 * 60 * 1000;
}

export function serializeProduct(product: Product, now = new Date()): SerializedProduct {
  return {
    id: product.id,
    product_name: product.productName,
    product_url: product.productUrl,
    source: product.source,
    price: product.price,
    price_checked_at: product.priceCheckedAt?.toISOString() ?? null,
    image_url: product.imageUrl,
    category: product.category,
    popularity_score: product.popularityScore,
    popularity_rank: product.popularityRank,
    popularity_source: product.popularitySource,
    popularity_checked_at: product.popularityCheckedAt?.toISOString() ?? null,
    memo: product.memo,
    stale: isOlderThanSevenDays(product.priceCheckedAt, now),
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  };
}

export function serializeShoppingConnectLink(
  link: ShoppingConnectLink,
): SerializedShoppingConnectLink {
  return {
    id: link.id,
    product_id: link.productId,
    content_package_id: link.contentPackageId,
    shopping_connect_url: link.shoppingConnectUrl,
    commission_rate: link.commissionRate,
    bonus_commission: link.bonusCommission,
    link_checked_at: link.linkCheckedAt?.toISOString() ?? null,
    is_active: link.isActive,
    notes: link.notes,
    stale: isOlderThanSevenDays(link.linkCheckedAt),
    created_at: link.createdAt.toISOString(),
    updated_at: link.updatedAt.toISOString(),
  };
}

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export class ProductImportBlockedError extends Error {
  readonly reason: InsaneSearchFailureReason | "invalid_url";
  readonly traceId: string | undefined;

  constructor(reason: InsaneSearchFailureReason | "invalid_url", traceId?: string) {
    super(`PRODUCT_IMPORT_BLOCKED:${reason}`);
    this.name = "ProductImportBlockedError";
    this.reason = reason;
    this.traceId = traceId;
  }
}

function assertImportableProduct(
  input: unknown,
  reason: InsaneSearchFailureReason = "metadata_missing",
): z.infer<typeof productCreateSchema> {
  const parsed = productCreateSchema.safeParse(input);
  if (!parsed.success || parsed.data.price === undefined) {
    throw new ProductImportBlockedError(reason);
  }
  return parsed.data;
}

export async function listProducts(staleOnly: boolean): Promise<SerializedProduct[]> {
  const products = await prisma.product.findMany({ orderBy: { updatedAt: "desc" } });
  return products
    .map((product) => serializeProduct(product))
    .filter((product) => !staleOnly || product.stale);
}

export async function createProduct(
  input: z.infer<typeof productCreateSchema>,
): Promise<SerializedProduct> {
  const popularityCheckedAt =
    input.popularity_score === undefined && input.popularity_rank === undefined
      ? undefined
      : new Date();
  const product = await prisma.product.create({
    data: {
      productName: input.product_name,
      productUrl: input.product_url ?? "manual://product",
      source: input.source ?? "manual",
      ...(input.price === undefined ? {} : { price: input.price, priceCheckedAt: new Date() }),
      ...(input.image_url === undefined ? {} : { imageUrl: input.image_url }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.popularity_score === undefined ? {} : { popularityScore: input.popularity_score }),
      ...(input.popularity_rank === undefined ? {} : { popularityRank: input.popularity_rank }),
      ...(input.popularity_source === undefined
        ? {}
        : { popularitySource: input.popularity_source }),
      ...(popularityCheckedAt === undefined ? {} : { popularityCheckedAt }),
      ...(input.memo === undefined ? {} : { memo: input.memo }),
    },
  });
  return serializeProduct(product);
}

export async function importProduct(
  input: z.infer<typeof productImportSchema>,
): Promise<SerializedProduct> {
  const validatedUrl = await validateProductImportUrl(input.url);
  if (!validatedUrl.ok) {
    throw new ProductImportBlockedError(validatedUrl.reason);
  }

  const crawlerResult = await importProductWithInsaneSearch(validatedUrl.url);
  if (crawlerResult.ok) {
    return createProduct(assertImportableProduct(crawlerResult.product, "metadata_missing"));
  }

  throw new ProductImportBlockedError(crawlerResult.reason, crawlerResult.trace_id);
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof productPatchSchema>,
): Promise<SerializedProduct | null> {
  const popularityCheckedAt =
    input.popularity_score === undefined && input.popularity_rank === undefined
      ? undefined
      : new Date();
  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(input.product_name === undefined ? {} : { productName: input.product_name }),
        ...(input.product_url === undefined ? {} : { productUrl: input.product_url }),
        ...(input.source === undefined ? {} : { source: input.source }),
        ...(input.price === undefined ? {} : { price: input.price, priceCheckedAt: new Date() }),
        ...(input.image_url === undefined ? {} : { imageUrl: input.image_url }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.popularity_score === undefined
          ? {}
          : { popularityScore: input.popularity_score }),
        ...(input.popularity_rank === undefined ? {} : { popularityRank: input.popularity_rank }),
        ...(input.popularity_source === undefined
          ? {}
          : { popularitySource: input.popularity_source }),
        ...(popularityCheckedAt === undefined ? {} : { popularityCheckedAt }),
        ...(input.memo === undefined ? {} : { memo: input.memo }),
      },
    });
    return serializeProduct(product);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    await prisma.product.delete({ where: { id } });
    return true;
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function listShoppingConnectLinks(
  staleOnly: boolean,
): Promise<SerializedShoppingConnectLink[]> {
  const links = await prisma.shoppingConnectLink.findMany({ orderBy: { updatedAt: "desc" } });
  return links
    .map((link) => serializeShoppingConnectLink(link))
    .filter((link) => !staleOnly || link.stale);
}

export async function createShoppingConnectLink(
  input: z.infer<typeof shoppingConnectLinkCreateSchema>,
) {
  const link = await prisma.shoppingConnectLink.create({
    data: {
      productId: input.product_id,
      ...(input.content_package_id === undefined
        ? {}
        : { contentPackageId: input.content_package_id }),
      shoppingConnectUrl: input.shopping_connect_url,
      commissionRate: input.commission_rate,
      ...(input.bonus_commission === undefined ? {} : { bonusCommission: input.bonus_commission }),
      linkCheckedAt: new Date(),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
    },
  });
  return serializeShoppingConnectLink(link);
}
export async function deleteShoppingConnectLink(id: string): Promise<boolean> {
  try {
    await prisma.shoppingConnectLink.delete({ where: { id } });
    return true;
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function updateShoppingConnectLink(
  id: string,
  input: z.infer<typeof shoppingConnectLinkPatchSchema>,
) {
  const shouldMarkChecked =
    input.mark_checked === true ||
    input.shopping_connect_url !== undefined ||
    input.commission_rate !== undefined;
  try {
    const link = await prisma.shoppingConnectLink.update({
      where: { id },
      data: {
        ...(input.product_id === undefined ? {} : { productId: input.product_id }),
        ...(input.content_package_id === undefined
          ? {}
          : { contentPackageId: input.content_package_id }),
        ...(input.shopping_connect_url === undefined
          ? {}
          : { shoppingConnectUrl: input.shopping_connect_url }),
        ...(input.commission_rate === undefined ? {} : { commissionRate: input.commission_rate }),
        ...(input.bonus_commission === undefined
          ? {}
          : { bonusCommission: input.bonus_commission }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.is_active === undefined ? {} : { isActive: input.is_active }),
        ...(shouldMarkChecked ? { linkCheckedAt: new Date() } : {}),
      },
    });
    return serializeShoppingConnectLink(link);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}
