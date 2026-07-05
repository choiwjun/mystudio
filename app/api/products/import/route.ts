import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { importProduct, productImportSchema } from "@/lib/products/service";

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
    const message = error instanceof Error ? error.message : "Product import failed.";
    if (message.startsWith("PRODUCT_IMPORT_BLOCKED:")) {
      return fail(
        {
          code: "PRODUCT_IMPORT_BLOCKED",
          message: "This URL cannot be imported automatically. Use manual input.",
          details: { reason: message.replace("PRODUCT_IMPORT_BLOCKED:", "") },
        },
        422,
      );
    }
    throw error;
  }
});
