import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { createProduct, listProducts, productCreateSchema } from "@/lib/products/service";

export const GET = withAuthenticatedApi("products.list", async (request) => {
  const staleOnly = request.nextUrl.searchParams.get("stale") === "true";
  return ok({ products: await listProducts(staleOnly) });
});

export const POST = withAuthenticatedApi("products.create", async (request) => {
  const parsed = productCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid product payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  return ok(await createProduct(parsed.data), { status: 201 });
});
