import {
  recommendShoppingConnectLinksForContentPackage,
  shoppingConnectRecommendationSchema,
} from "@/lib/affiliate/shoppingConnectRecommendations";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

export const POST = withAuthenticatedApi("shopping-connect.recommendations", async (request) => {
  const parsed = shoppingConnectRecommendationSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "content_package_id is required.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  const result = await recommendShoppingConnectLinksForContentPackage(parsed.data);
  if (result === null) {
    return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
  }
  return ok(result);
});
