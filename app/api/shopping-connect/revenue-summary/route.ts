import { ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getRevenueSummary } from "@/lib/performance/service";

export const GET = withAuthenticatedApi("shopping-connect.revenue-summary", async () => {
  return ok(await getRevenueSummary());
});
