import { ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { getWinningPatterns } from "@/lib/memory/service";

export const GET = withAuthenticatedApi("memory.winning-patterns", async () => {
  return ok(await getWinningPatterns());
});
