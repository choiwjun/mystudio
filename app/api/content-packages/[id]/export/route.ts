import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { exportContentPackage } from "@/lib/export/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("content-packages.export", async () => {
    const params = await context.params;
    const result = await exportContentPackage(params.id);
    switch (result.kind) {
      case "missing":
        return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
      case "blocked":
        return fail({ code: "EXPORT_BLOCKED", message: result.reason }, 403);
      case "exported":
        return ok({ exports: result.exports }, { status: 201 });
    }
  });
  return guarded(request);
}
