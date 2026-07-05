import type { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getContentPerformance } from "@/lib/performance/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("performance.content", async () => {
    const params = await context.params;
    return ok(await getContentPerformance(params.id));
  });
  return guarded(request);
}
