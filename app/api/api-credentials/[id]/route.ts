import type { NextRequest } from "next/server";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import {
  apiCredentialPatchSchema,
  deleteApiCredential,
  updateApiCredential,
} from "@/lib/api-credentials/service";
import { withAuthenticatedApi } from "@/lib/auth/guards";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("api-credentials.patch", async () => {
    const parsed = apiCredentialPatchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid API credential patch payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }

    const params = await context.params;
    const credential = await updateApiCredential(params.id, parsed.data);
    if (credential === null) {
      return fail({ code: "NOT_FOUND", message: "API credential was not found." }, 404);
    }
    return ok(credential);
  });
  return guarded(request);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("api-credentials.delete", async () => {
    const params = await context.params;
    const deleted = await deleteApiCredential(params.id);
    if (!deleted) {
      return fail({ code: "NOT_FOUND", message: "API credential was not found." }, 404);
    }
    return ok({ deleted: true });
  });
  return guarded(request);
}
