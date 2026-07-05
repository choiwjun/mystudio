import { ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getHqStatus } from "@/lib/hq/service";

export const GET = withAuthenticatedApi("hq.status", async () => {
  return ok(await getHqStatus());
});
