import { ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getHqToday } from "@/lib/hq/service";

export const GET = withAuthenticatedApi("hq.today", async () => {
  return ok(await getHqToday());
});
