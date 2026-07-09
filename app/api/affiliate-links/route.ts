import {
  affiliateLinkCreateSchema,
  createAffiliateLink,
  listAffiliateLinks,
} from "@/lib/affiliate/service";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

export const GET = withAuthenticatedApi("affiliate-links.list", async (request) => {
  const staleOnly = request.nextUrl.searchParams.get("stale") === "true";
  return ok({ affiliate_links: await listAffiliateLinks(staleOnly) });
});

export const POST = withAuthenticatedApi("affiliate-links.create", async (request) => {
  const parsed = affiliateLinkCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid affiliate link payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  return ok(await createAffiliateLink(parsed.data), { status: 201 });
});
