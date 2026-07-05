import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { deleteProduct, productPatchSchema, updateProduct } from "@/lib/products/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("products.patch", async () => {
    const parsed = productPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail(
        {
          code: "BAD_REQUEST",
          message: "Invalid product patch payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }

    const params = await context.params;
    const product = await updateProduct(params.id, parsed.data);
    if (product === null) {
      return fail({ code: "NOT_FOUND", message: "Product was not found." }, 404);
    }
    return ok(product);
  });
  return guarded(request);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("products.delete", async () => {
    const params = await context.params;
    const deleted = await deleteProduct(params.id);
    if (!deleted) {
      return fail({ code: "NOT_FOUND", message: "Product was not found." }, 404);
    }
    return ok({ deleted: true });
  });
  return guarded(request);
}
