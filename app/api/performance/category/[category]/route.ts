import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getCategoryPerformance } from "@/lib/performance/service";

type RouteContext = {
  readonly params: Promise<{ readonly category: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("performance.category", async () => {
    const params = await context.params;
    const category = decodeURIComponent(params.category).trim();
    if (category === "") {
      return fail({ code: "VALIDATION_ERROR", message: "category is required." }, 400);
    }
    return ok(await getCategoryPerformance(category));
  });
  return guarded(request);
}
