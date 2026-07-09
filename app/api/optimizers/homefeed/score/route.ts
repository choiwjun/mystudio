import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { packageIdSchema, scoreContentPackageHomefeed } from "@/lib/content/service";

export const POST = withAuthenticatedApi("optimizers.homefeed.score", async (request) => {
  const parsed = packageIdSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "content_package_id is required." }, 400);
  }

  const result = await scoreContentPackageHomefeed(parsed.data.content_package_id);
  if (result === null) {
    return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
  }
  if (result.kind === "draft_required") {
    return fail(
      { code: "DRAFT_REQUIRED", message: "홈피드 점수 계산 전 블로그 초안이 필요합니다." },
      409,
    );
  }
  if (result.kind === "blocked_by_budget") {
    return fail({ ...result.error, details: { budget: result.budget } }, 429);
  }

  return ok(result);
});
