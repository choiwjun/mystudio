import { Prisma, type Product, type ShoppingConnectLink } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateProductImportUrl } from "@/lib/security/productImport";

const productNameMaxLength = 160;
const productSourceMaxLength = 80;
const productUrlMaxLength = 2048;
const productCategoryMaxLength = 80;
const productMemoMaxLength = 500;
const importedProductNameMaxLength = productNameMaxLength;
const importedCategoryMaxLength = productCategoryMaxLength;

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

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanImportedText(value: string, maxLength = importedProductNameMaxLength): string {
  const cleaned = value
    .replace(/\+/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}

function firstCleanParam(
  url: URL,
  names: readonly string[],
  maxLength = importedProductNameMaxLength,
): string | undefined {
  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value !== null) {
      const cleaned = cleanImportedText(value, maxLength);
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }
  return undefined;
}

function cleanPathProductName(url: URL): string | undefined {
  const segments = url.pathname
    .split("/")
    .map((segment) => cleanImportedText(decodePathSegment(segment).replace(/[-–—]+/g, " ")))
    .filter((segment) => segment.length > 0 && !/^\d+$/.test(segment));

  const ignoredSegments = new Set(["search", "all", "products", "product", "catalog", "ns"]);
  const candidate = segments
    .reverse()
    .find((segment) => !ignoredSegments.has(segment.toLowerCase()) && !segment.includes("."));
  return candidate;
}
function parseOptionalPrice(url: URL): number | undefined {
  const rawPrice = firstCleanParam(url, ["price", "lowPrice", "salePrice", "productPrice"]);
  if (rawPrice === undefined) {
    return undefined;
  }
  const price = Number.parseInt(rawPrice.replace(/[^\d]/g, ""), 10);
  return Number.isSafeInteger(price) && price >= 0 ? price : undefined;
}

function parseOptionalImageUrl(url: URL): string | undefined {
  const imageUrl = firstCleanParam(
    url,
    ["image", "imageUrl", "img", "thumbnail", "thumb"],
    productUrlMaxLength,
  );
  if (imageUrl === undefined || imageUrl.length > productUrlMaxLength) {
    return undefined;
  }

  try {
    const parsedImageUrl = new URL(imageUrl);
    return ["http:", "https:"].includes(parsedImageUrl.protocol)
      ? parsedImageUrl.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseNaverProductFromUrl(url: URL): z.infer<typeof productCreateSchema> {
  const productName =
    firstCleanParam(url, [
      "query",
      "keyword",
      "title",
      "productTitle",
      "productName",
      "goodsName",
      "itemName",
      "name",
    ]) ?? cleanPathProductName(url);
  if (productName === undefined) {
    throw new Error("PRODUCT_IMPORT_BLOCKED:missing_product_metadata");
  }
  const category = firstCleanParam(
    url,
    ["catName", "categoryName", "category", "cat", "menu", "displayCategoryName"],
    importedCategoryMaxLength,
  );

  return {
    product_name: productName,
    product_url: url.toString(),
    source: "naver_shopping",
    price: parseOptionalPrice(url),
    image_url: parseOptionalImageUrl(url),
    category,
    memo: `Naver Shopping URL import from ${url.hostname}. Price needs confirmation before publishing.`,
  };
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
  const product = await prisma.product.create({
    data: {
      productName: input.product_name,
      productUrl: input.product_url ?? "manual://product",
      source: input.source ?? "manual",
      ...(input.price === undefined ? {} : { price: input.price, priceCheckedAt: new Date() }),
      ...(input.image_url === undefined ? {} : { imageUrl: input.image_url }),
      ...(input.category === undefined ? {} : { category: input.category }),
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
    throw new Error(`PRODUCT_IMPORT_BLOCKED:${validatedUrl.reason}`);
  }
  return createProduct(parseNaverProductFromUrl(validatedUrl.url));
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof productPatchSchema>,
): Promise<SerializedProduct | null> {
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
