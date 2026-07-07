import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  importProduct,
  ProductImportBlockedError,
  productImportSchema,
} from "@/lib/products/service";

export const POST = withAuthenticatedApi("products.import", async (request) => {
  const parsed = productImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      {
        code: "BAD_REQUEST",
        message: "A product URL is required.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  try {
    return ok(await importProduct(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof ProductImportBlockedError) {
      const { reason, traceId } = error;
      return fail(
        {
          code: "PRODUCT_IMPORT_BLOCKED",
          message: "This URL cannot be imported automatically. Use manual input.",
          details: { reason, ...(traceId === undefined ? {} : { trace_id: traceId }) },
        },
        422,
      );
    }
    throw error;
  }
});
