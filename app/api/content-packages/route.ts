import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  contentPackageCreateSchema,
  createOrBriefContentPackage,
  listContentPackages,
  parsePackageStatus,
} from "@/lib/content/service";

export const GET = withAuthenticatedApi("content-packages.list", async (request) => {
  const status = parsePackageStatus(request.nextUrl.searchParams.get("status"));
  return ok({ content_packages: await listContentPackages(status) });
});

export const POST = withAuthenticatedApi("content-packages.create", async (request) => {
  const parsed = contentPackageCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "BAD_REQUEST",
        message: "Invalid content package payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  const contentPackage = await createOrBriefContentPackage(parsed.data);
  if (contentPackage === null) {
    return fail({ code: "NOT_FOUND", message: "Selected decision package was not found." }, 404);
  }
  return ok(contentPackage, { status: 201 });
});
