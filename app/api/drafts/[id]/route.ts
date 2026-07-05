import type { NextRequest } from "next/server";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { draftPatchSchema, updateDraft } from "@/lib/content/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("drafts.patch", async () => {
    const parsed = draftPatchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return fail(
        {
          code: "BAD_REQUEST",
          message: "Invalid draft payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }

    const params = await context.params;
    const draft = await updateDraft(params.id, parsed.data);
    if (draft === null) {
      return fail({ code: "NOT_FOUND", message: "Draft was not found." }, 404);
    }
    return ok(draft);
  });
  return guarded(request);
}
