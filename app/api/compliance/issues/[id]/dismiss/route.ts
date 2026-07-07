import type { NextRequest } from "next/server";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { dismissComplianceIssue, issueDismissSchema } from "@/lib/compliance/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("compliance.issues.dismiss", async () => {
    const parsed = issueDismissSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid issue dismissal payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }

    const params = await context.params;
    const result = await dismissComplianceIssue(params.id, parsed.data);
    switch (result.kind) {
      case "missing":
        return fail({ code: "NOT_FOUND", message: "Compliance issue was not found." }, 404);
      case "blocked":
        return fail({ code: "COMPLIANCE_DISMISS_BLOCKED", message: result.reason }, 403);
      case "dismissed":
        return ok({ issue: result.issue, compliance_check: result.compliance_check });
    }
  });
  return guarded(request);
}
