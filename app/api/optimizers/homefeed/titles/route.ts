import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getContentPackage, packageIdSchema } from "@/lib/content/service";
import { generateHomefeedTitles } from "@/lib/content/titleService";

export const POST = withAuthenticatedApi("optimizers.homefeed.titles", async (request) => {
  const parsed = packageIdSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail({ code: "BAD_REQUEST", message: "content_package_id is required." }, 400);
  }

  const contentPackage = await getContentPackage(parsed.data.content_package_id);
  if (contentPackage === null) {
    return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
  }

  return ok(
    await generateHomefeedTitles(parsed.data.content_package_id, contentPackage.topic.title),
  );
});
