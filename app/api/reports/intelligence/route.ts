import { ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getReportIntelligence } from "@/lib/reports/service";

export const GET = withAuthenticatedApi("reports.intelligence", async () => {
  return ok(await getReportIntelligence());
});
