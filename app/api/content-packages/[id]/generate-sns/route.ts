import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { generateSnsVariants } from "@/lib/content/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("content-packages.generate-sns", async () => {
    const params = await context.params;
    const result = await generateSnsVariants(params.id);
    if (result === null) {
      return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
    }
    switch (result.kind) {
      case "draft_required":
        return fail(
          {
            code: "DRAFT_REQUIRED",
            message: "블로그 초안 생성 후 클립/SNS 변환을 실행하세요.",
          },
          409,
        );
      case "blocked_by_budget":
        return fail(result.error, 429);
      case "generated":
        return ok({ content_package: result.content_package });
    }
  });
  return guarded(request);
}
