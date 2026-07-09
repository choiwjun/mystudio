import { withApiErrorLogging } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

export const POST = withApiErrorLogging("auth.logout", async () => ok({ logged_out: true }));
