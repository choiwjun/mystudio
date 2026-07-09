import { type AffiliateAccount, type AffiliateLink, Prisma } from "@prisma/client";
import { z } from "zod";
import { getOrCreateCompanyProfile } from "@/lib/company-profile/service";
import { prisma } from "@/lib/db";
import { isOlderThanSevenDays } from "@/lib/products/service";

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

export const affiliateAccountStatuses = ["active", "setup_needed", "paused"] as const;

const urlOrEmptySchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || value.startsWith("https://") || value.startsWith("http://"));

export const affiliateAccountCreateSchema = z.object({
  platform: z.enum(affiliateAccountPlatforms),
  account_name: z.string().trim().min(1).max(120),
  channel_url: urlOrEmptySchema.optional(),
  affiliate_program: z.string().trim().min(1).max(120),
  disclosure_policy: z.string().trim().max(500).optional(),
  category_focus: z.array(z.string().trim().min(1).max(80)).default([]),
  sns_targets: z.array(z.enum(["instagram", "threads", "x", "youtube"])).default([]),
  hook_style: z.string().trim().max(120).optional(),
  status: z.enum(affiliateAccountStatuses).default("setup_needed"),
  memo: z.string().trim().max(1000).optional(),
});

export const affiliateAccountPatchSchema = affiliateAccountCreateSchema.partial();

export const affiliateLinkCreateSchema = z.object({
  account_id: z.string().min(1).optional(),
  product_id: z.string().min(1).optional(),
  content_package_id: z.string().min(1).optional(),
  platform: z.enum(affiliateAccountPlatforms),
  program: z.string().trim().min(1).max(120),
  destination_url: z.string().trim().url().max(2048),
  affiliate_url: z.string().trim().url().max(2048),
  commission_rate: z.number().nonnegative().optional(),
  disclosure_policy: z.string().trim().max(500).optional(),
  placement_guide: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const affiliateLinkPatchSchema = affiliateLinkCreateSchema.partial().extend({
  account_id: z.string().min(1).nullable().optional(),
  product_id: z.string().min(1).nullable().optional(),
  content_package_id: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
  mark_checked: z.boolean().optional(),
});

export type SerializedAffiliateAccount = {
  readonly id: string;
  readonly platform: (typeof affiliateAccountPlatforms)[number];
  readonly account_name: string;
  readonly channel_url: string;
  readonly affiliate_program: string;
  readonly disclosure_policy: string;
  readonly category_focus: readonly string[];
  readonly sns_targets: readonly string[];
  readonly hook_style: string;
  readonly status: (typeof affiliateAccountStatuses)[number];
  readonly memo: string;
  readonly created_at: string;
  readonly updated_at: string;
};

export type SerializedAffiliateLink = {
  readonly id: string;
  readonly account_id: string | null;
  readonly product_id: string | null;
  readonly content_package_id: string | null;
  readonly platform: (typeof affiliateAccountPlatforms)[number];
  readonly program: string;
  readonly destination_url: string;
  readonly affiliate_url: string;
  readonly commission_rate: number | null;
  readonly disclosure_policy: string | null;
  readonly placement_guide: string | null;
  readonly is_active: boolean;
  readonly link_checked_at: string | null;
  readonly notes: string | null;
  readonly stale: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function parsePlatform(platform: string): SerializedAffiliateAccount["platform"] {
  const parsed = z.enum(affiliateAccountPlatforms).safeParse(platform);
  return parsed.success ? parsed.data : "other";
}

function parseStatus(status: string): SerializedAffiliateAccount["status"] {
  const parsed = z.enum(affiliateAccountStatuses).safeParse(status);
  return parsed.success ? parsed.data : "setup_needed";
}

function serializeAffiliateAccount(account: AffiliateAccount): SerializedAffiliateAccount {
  return {
    id: account.id,
    platform: parsePlatform(account.platform),
    account_name: account.accountName,
    channel_url: account.channelUrl ?? "",
    affiliate_program: account.affiliateProgram,
    disclosure_policy: account.disclosurePolicy ?? "",
    category_focus: account.categoryFocus,
    sns_targets: account.snsTargets,
    hook_style: account.hookStyle ?? "",
    status: parseStatus(account.status),
    memo: account.memo ?? "",
    created_at: account.createdAt.toISOString(),
    updated_at: account.updatedAt.toISOString(),
  };
}

function serializeAffiliateLink(link: AffiliateLink): SerializedAffiliateLink {
  return {
    id: link.id,
    account_id: link.accountId,
    product_id: link.productId,
    content_package_id: link.contentPackageId,
    platform: parsePlatform(link.platform),
    program: link.program,
    destination_url: link.destinationUrl,
    affiliate_url: link.affiliateUrl,
    commission_rate: link.commissionRate,
    disclosure_policy: link.disclosurePolicy,
    placement_guide: link.placementGuide,
    is_active: link.isActive,
    link_checked_at: link.linkCheckedAt?.toISOString() ?? null,
    notes: link.notes,
    stale: isOlderThanSevenDays(link.linkCheckedAt),
    created_at: link.createdAt.toISOString(),
    updated_at: link.updatedAt.toISOString(),
  };
}

async function defaultWorkspaceId(): Promise<string> {
  const profile = await getOrCreateCompanyProfile();
  return profile.workspaceId;
}

async function ensureDefaultAffiliateAccount(): Promise<void> {
  const workspaceId = await defaultWorkspaceId();
  const existingCount = await prisma.affiliateAccount.count({ where: { workspaceId } });
  if (existingCount > 0) {
    return;
  }
  await prisma.affiliateAccount.create({
    data: {
      workspaceId,
      platform: "shopping_connect",
      accountName: "쇼핑커넥트 기본 계정",
      channelUrl: "",
      affiliateProgram: "네이버 쇼핑커넥트",
      disclosurePolicy: "대가성 문구 상단 표기",
      categoryFocus: ["생활", "쇼핑"],
      snsTargets: ["instagram", "threads"],
      hookStyle: "문제공감형",
      status: "setup_needed",
      memo: "블로그, 클립, SNS 중 승인 채널을 연결한 뒤 운영 상태로 변경",
    },
  });
}

export async function listAffiliateAccounts(): Promise<SerializedAffiliateAccount[]> {
  await ensureDefaultAffiliateAccount();
  const workspaceId = await defaultWorkspaceId();
  const accounts = await prisma.affiliateAccount.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return accounts.map(serializeAffiliateAccount);
}

export async function createAffiliateAccount(
  input: z.infer<typeof affiliateAccountCreateSchema>,
): Promise<SerializedAffiliateAccount> {
  const account = await prisma.affiliateAccount.create({
    data: {
      workspaceId: await defaultWorkspaceId(),
      platform: input.platform,
      accountName: input.account_name,
      channelUrl: input.channel_url ?? "",
      affiliateProgram: input.affiliate_program,
      disclosurePolicy: input.disclosure_policy ?? "",
      categoryFocus: input.category_focus,
      snsTargets: input.sns_targets,
      hookStyle: input.hook_style ?? "",
      status: input.status,
      memo: input.memo ?? "",
    },
  });
  return serializeAffiliateAccount(account);
}

export async function updateAffiliateAccount(
  id: string,
  input: z.infer<typeof affiliateAccountPatchSchema>,
): Promise<SerializedAffiliateAccount | null> {
  try {
    const account = await prisma.affiliateAccount.update({
      where: { id },
      data: {
        ...(input.platform === undefined ? {} : { platform: input.platform }),
        ...(input.account_name === undefined ? {} : { accountName: input.account_name }),
        ...(input.channel_url === undefined ? {} : { channelUrl: input.channel_url }),
        ...(input.affiliate_program === undefined
          ? {}
          : { affiliateProgram: input.affiliate_program }),
        ...(input.disclosure_policy === undefined
          ? {}
          : { disclosurePolicy: input.disclosure_policy }),
        ...(input.category_focus === undefined ? {} : { categoryFocus: input.category_focus }),
        ...(input.sns_targets === undefined ? {} : { snsTargets: input.sns_targets }),
        ...(input.hook_style === undefined ? {} : { hookStyle: input.hook_style }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.memo === undefined ? {} : { memo: input.memo }),
      },
    });
    return serializeAffiliateAccount(account);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteAffiliateAccount(id: string): Promise<boolean> {
  try {
    await prisma.affiliateAccount.delete({ where: { id } });
    return true;
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function listAffiliateLinks(staleOnly: boolean): Promise<SerializedAffiliateLink[]> {
  const links = await prisma.affiliateLink.findMany({ orderBy: { updatedAt: "desc" } });
  return links.map(serializeAffiliateLink).filter((link) => !staleOnly || link.stale);
}

export async function createAffiliateLink(
  input: z.infer<typeof affiliateLinkCreateSchema>,
): Promise<SerializedAffiliateLink> {
  const data: Prisma.AffiliateLinkUncheckedCreateInput = {
    ...(input.account_id === undefined ? {} : { accountId: input.account_id }),
    ...(input.product_id === undefined ? {} : { productId: input.product_id }),
    ...(input.content_package_id === undefined
      ? {}
      : { contentPackageId: input.content_package_id }),
    platform: input.platform,
    program: input.program,
    destinationUrl: input.destination_url,
    affiliateUrl: input.affiliate_url,
    commissionRate: input.commission_rate ?? 0,
    disclosurePolicy: input.disclosure_policy ?? "대가성 문구를 본문 상단과 링크 근처에 표시",
    ...(input.placement_guide === undefined ? {} : { placementGuide: input.placement_guide }),
    linkCheckedAt: new Date(),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  };
  const link = await prisma.affiliateLink.create({
    data,
  });
  return serializeAffiliateLink(link);
}

export async function updateAffiliateLink(
  id: string,
  input: z.infer<typeof affiliateLinkPatchSchema>,
): Promise<SerializedAffiliateLink | null> {
  const shouldMarkChecked =
    input.mark_checked === true ||
    input.affiliate_url !== undefined ||
    input.destination_url !== undefined ||
    input.commission_rate !== undefined;
  try {
    const link = await prisma.affiliateLink.update({
      where: { id },
      data: {
        ...(input.account_id === undefined ? {} : { accountId: input.account_id }),
        ...(input.product_id === undefined ? {} : { productId: input.product_id }),
        ...(input.content_package_id === undefined
          ? {}
          : { contentPackageId: input.content_package_id }),
        ...(input.platform === undefined ? {} : { platform: input.platform }),
        ...(input.program === undefined ? {} : { program: input.program }),
        ...(input.destination_url === undefined ? {} : { destinationUrl: input.destination_url }),
        ...(input.affiliate_url === undefined ? {} : { affiliateUrl: input.affiliate_url }),
        ...(input.commission_rate === undefined ? {} : { commissionRate: input.commission_rate }),
        ...(input.disclosure_policy === undefined
          ? {}
          : { disclosurePolicy: input.disclosure_policy }),
        ...(input.placement_guide === undefined ? {} : { placementGuide: input.placement_guide }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.is_active === undefined ? {} : { isActive: input.is_active }),
        ...(shouldMarkChecked ? { linkCheckedAt: new Date() } : {}),
      },
    });
    return serializeAffiliateLink(link);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteAffiliateLink(id: string): Promise<boolean> {
  try {
    await prisma.affiliateLink.delete({ where: { id } });
    return true;
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}
