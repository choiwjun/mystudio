import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  createShoppingConnectLink,
  listShoppingConnectLinks,
  shoppingConnectLinkCreateSchema,
} from "@/lib/products/service";

export const GET = withAuthenticatedApi("shopping-connect-links.list", async (request) => {
  const staleOnly = request.nextUrl.searchParams.get("stale") === "true";
  return ok({ shopping_connect_links: await listShoppingConnectLinks(staleOnly) });
});

export const POST = withAuthenticatedApi("shopping-connect-links.create", async (request) => {
  const parsed = shoppingConnectLinkCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      {
        code: "BAD_REQUEST",
        message: "Invalid shopping connect link payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  return ok(await createShoppingConnectLink(parsed.data), { status: 201 });
});
