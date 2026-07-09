import {
  recommendShoppingConnectPlacement,
  shoppingConnectPlacementSchema,
} from "@/lib/affiliate/shoppingConnectOptimizer";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

export const POST = withAuthenticatedApi("shopping-connect.link-placement", async (request) => {
  const parsed = shoppingConnectPlacementSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "product_id and content_package_id are required.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  const result = await recommendShoppingConnectPlacement(parsed.data);
  if (result === null) {
    return fail({ code: "NOT_FOUND", message: "Product or content package was not found." }, 404);
  }
  return ok(result);
});
