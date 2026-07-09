import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { complianceCheckSchema, runComplianceCheck } from "@/lib/compliance/service";

export const POST = withAuthenticatedApi("compliance.check", async (request) => {
  const parsed = complianceCheckSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid compliance check payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  const check = await runComplianceCheck(parsed.data);
  if (check === null) {
    return fail({ code: "NOT_FOUND", message: "Draft was not found." }, 404);
  }
  return ok(check, { status: 201 });
});
