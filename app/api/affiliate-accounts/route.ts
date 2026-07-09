import {
  affiliateAccountCreateSchema,
  createAffiliateAccount,
  listAffiliateAccounts,
} from "@/lib/affiliate/service";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

export const GET = withAuthenticatedApi("affiliate-accounts.list", async () => {
  return ok({ affiliate_accounts: await listAffiliateAccounts() });
});

export const POST = withAuthenticatedApi("affiliate-accounts.create", async (request) => {
  const parsed = affiliateAccountCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid affiliate account payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  return ok(await createAffiliateAccount(parsed.data), { status: 201 });
});
