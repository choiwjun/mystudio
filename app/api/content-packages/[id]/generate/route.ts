import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { generateContentPackage } from "@/lib/content/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("content-packages.generate", async () => {
    const params = await context.params;
    const result = await generateContentPackage(params.id);
    if (result === null) {
      return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
    }
    switch (result.kind) {
      case "blocked_by_budget":
        return fail(result.error, 429);
      case "generated":
        return ok({ draft: result.draft, content_package: result.content_package });
    }
  });
  return guarded(request);
}
