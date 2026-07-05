import { ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { listOpportunityMemos } from "@/lib/hermes/service";

export const GET = withAuthenticatedApi("hermes.opportunity-memos.list", async () => {
  return ok({ opportunity_memos: await listOpportunityMemos() });
});
