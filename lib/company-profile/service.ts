import { z } from "zod";
import { prisma } from "@/lib/db";

export const companyProfilePatchSchema = z
  .object({
    company_name: z.string().trim().min(1).optional(),
    primary_categories: z.array(z.string().trim().min(1)).max(12).optional(),
    blocked_categories: z.array(z.string().trim().min(1)).max(24).optional(),
    tone_rules: z.string().trim().max(2000).optional(),
    content_principles: z.string().trim().max(2000).optional(),
    revenue_goal_monthly: z.number().int().nonnegative().max(100_000_000).optional(),
  })
  .strict();

type CompanyProfileRecord = Awaited<ReturnType<typeof getOrCreateCompanyProfile>>;

export type SerializedCompanyProfile = {
  readonly id: string;
  readonly company_name: string;
  readonly primary_categories: readonly string[];
  readonly blocked_categories: readonly string[];
  readonly tone_rules: string;
  readonly content_principles: string;
  readonly revenue_goal_monthly: number;
  readonly updated_at: string;
  readonly setup_required: boolean;
};

export class CompanyProfileSetupRequiredError extends Error {
  constructor() {
    super("Company profile must be completed before Hermes or Content generation.");
    this.name = "CompanyProfileSetupRequiredError";
  }
}

export function isCompanyProfileSetupRequiredError(
  error: unknown,
): error is CompanyProfileSetupRequiredError {
  return error instanceof CompanyProfileSetupRequiredError;
}

export function profileSetupRequiredError() {
  return {
    code: "PROFILE_SETUP_REQUIRED",
    message: "회사 프로필 설정이 필요합니다.",
    details: { settings_path: "/settings" },
  };
}

async function getDefaultWorkspace() {
  return prisma.workspace.upsert({
    where: { id: "default_workspace" },
    update: {},
    create: {
      id: "default_workspace",
      name: "default",
    },
  });
}

export async function getOrCreateCompanyProfile() {
  const workspace = await getDefaultWorkspace();
  const existing = await prisma.companyProfile.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });

  if (existing !== null) {
    return existing;
  }

  return prisma.companyProfile.create({
    data: {
      id: "default_company_profile",
      workspaceId: workspace.id,
      companyName: "",
      primaryCategories: [],
      blockedCategories: [],
      toneRules: "",
      contentPrinciples: "",
      revenueGoalMonthly: 500_000,
    },
  });
}

export function isCompanyProfileComplete(
  profile: Pick<CompanyProfileRecord, "companyName" | "primaryCategories">,
): boolean {
  return profile.companyName.trim().length > 0 && profile.primaryCategories.length > 0;
}

export function serializeCompanyProfile(profile: CompanyProfileRecord): SerializedCompanyProfile {
  return {
    id: profile.id,
    company_name: profile.companyName,
    primary_categories: profile.primaryCategories,
    blocked_categories: profile.blockedCategories,
    tone_rules: profile.toneRules,
    content_principles: profile.contentPrinciples,
    revenue_goal_monthly: profile.revenueGoalMonthly,
    updated_at: profile.updatedAt.toISOString(),
    setup_required: !isCompanyProfileComplete(profile),
  };
}

export async function updateCompanyProfile(input: z.infer<typeof companyProfilePatchSchema>) {
  const profile = await getOrCreateCompanyProfile();
  return prisma.companyProfile.update({
    where: { id: profile.id },
    data: {
      ...(input.company_name === undefined ? {} : { companyName: input.company_name }),
      ...(input.primary_categories === undefined
        ? {}
        : { primaryCategories: input.primary_categories }),
      ...(input.blocked_categories === undefined
        ? {}
        : { blockedCategories: input.blocked_categories }),
      ...(input.tone_rules === undefined ? {} : { toneRules: input.tone_rules }),
      ...(input.content_principles === undefined
        ? {}
        : { contentPrinciples: input.content_principles }),
      ...(input.revenue_goal_monthly === undefined
        ? {}
        : { revenueGoalMonthly: input.revenue_goal_monthly }),
    },
  });
}

export async function assertCompanyProfileReady(): Promise<void> {
  const profile = await getOrCreateCompanyProfile();
  if (!isCompanyProfileComplete(profile)) {
    throw new CompanyProfileSetupRequiredError();
  }
}
