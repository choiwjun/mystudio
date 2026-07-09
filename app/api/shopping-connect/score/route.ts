import {
  scoreShoppingConnectProduct,
  shoppingConnectScoreSchema,
} from "@/lib/affiliate/shoppingConnectOptimizer";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";

export const POST = withAuthenticatedApi("shopping-connect.score", async (request) => {
  const parsed = shoppingConnectScoreSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "product_id is required.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  const result = await scoreShoppingConnectProduct(parsed.data);
  if (result === null) {
    return fail({ code: "NOT_FOUND", message: "Product or content package was not found." }, 404);
  }
  return ok(result);
});
