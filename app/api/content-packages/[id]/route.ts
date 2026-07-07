import type { NextRequest } from "next/server";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import {
  ContentPackageStatusBlockedError,
  contentPackageStatusPatchSchema,
  getContentPackage,
  updateContentPackageStatus,
} from "@/lib/content/service";
import { IllegalPackageStatusTransitionError } from "@/lib/content/statusTransitions";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("content-packages.get", async () => {
    const params = await context.params;
    const contentPackage = await getContentPackage(params.id);
    if (contentPackage === null) {
      return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
    }
    return ok(contentPackage);
  });
  return guarded(request);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("content-packages.update-status", async () => {
    const parsed = contentPackageStatusPatchSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return fail(
        {
          code: "BAD_REQUEST",
          message: "Invalid content package status payload.",
          details: { issues: parsed.error.flatten().fieldErrors },
        },
        400,
      );
    }
    const params = await context.params;
    try {
      const contentPackage = await updateContentPackageStatus(params.id, parsed.data);
      if (contentPackage === null) {
        return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
      }
      return ok(contentPackage);
    } catch (error) {
      if (error instanceof ContentPackageStatusBlockedError) {
        return fail(
          {
            code: "CONTENT_PACKAGE_STATUS_BLOCKED",
            message: error.message,
            details: { reason: error.reason },
          },
          409,
        );
      }
      if (error instanceof IllegalPackageStatusTransitionError) {
        return fail(
          {
            code: "INVALID_STATUS_TRANSITION",
            message: error.message,
            details: { reason: "invalid_transition" },
          },
          409,
        );
      }
      throw error;
    }
  });
  return guarded(request);
}
