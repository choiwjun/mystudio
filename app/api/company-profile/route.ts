import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  companyProfilePatchSchema,
  getOrCreateCompanyProfile,
  serializeCompanyProfile,
  updateCompanyProfile,
} from "@/lib/company-profile/service";

export const GET = withAuthenticatedApi("company-profile.get", async () => {
  const profile = await getOrCreateCompanyProfile();
  return ok(serializeCompanyProfile(profile));
});

export const PATCH = withAuthenticatedApi("company-profile.patch", async (request) => {
  const parsed = companyProfilePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      {
        code: "BAD_REQUEST",
        message: "Invalid company profile payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  const profile = await updateCompanyProfile(parsed.data);
  return ok(serializeCompanyProfile(profile));
});
