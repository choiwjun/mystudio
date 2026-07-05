import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getPaperclipDecision } from "@/lib/decisions/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("hq.decisions.get", async () => {
    const params = await context.params;
    const decision = await getPaperclipDecision(params.id);
    if (decision === null) {
      return fail({ code: "NOT_FOUND", message: "Decision was not found." }, 404);
    }
    return ok(decision);
  });
  return guarded(request);
}
