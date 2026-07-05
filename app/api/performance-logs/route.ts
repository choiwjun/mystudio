import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  createPerformanceLog,
  listPerformanceLogs,
  performanceLogCreateSchema,
} from "@/lib/performance/service";

export const GET = withAuthenticatedApi("performance-logs.list", async (request) => {
  const period = request.nextUrl.searchParams.get("period") === "week" ? "week" : "all";
  return ok(await listPerformanceLogs(period));
});

export const POST = withAuthenticatedApi("performance-logs.create", async (request) => {
  const parsed = performanceLogCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "BAD_REQUEST",
        message: "Invalid performance log payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }
  const log = await createPerformanceLog(parsed.data);
  if (log === null) {
    return fail({ code: "NOT_FOUND", message: "Content package is required." }, 404);
  }
  return ok(log, { status: 201 });
});
