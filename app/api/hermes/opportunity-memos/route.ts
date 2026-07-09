import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { createOpportunityMemo, opportunityMemoCreateSchema } from "@/lib/hermes/manualMemo";
import { listOpportunityMemos } from "@/lib/hermes/service";

export const GET = withAuthenticatedApi("hermes.opportunity-memos.list", async () => {
  return ok({ opportunity_memos: await listOpportunityMemos() });
});

export const POST = withAuthenticatedApi("hermes.opportunity-memos.create", async (request) => {
  const parsed = opportunityMemoCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "A valid opportunity memo payload is required.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  return ok({ opportunity_memo: await createOpportunityMemo(parsed.data) }, { status: 201 });
});
