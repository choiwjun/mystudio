import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { exportContentPackage, exportRequestSchema } from "@/lib/export/service";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

type ExportRequestParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

async function parseExportRequest(request: NextRequest): Promise<ExportRequestParseResult> {
  const bodyText = await request.text();
  if (bodyText.trim().length === 0) {
    return { ok: true, value: {} };
  }

  try {
    return { ok: true, value: JSON.parse(bodyText) as unknown };
  } catch {
    return { ok: false };
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const guarded = withAuthenticatedApi("content-packages.export", async () => {
    const params = await context.params;
    const requestBody = await parseExportRequest(request);
    if (!requestBody.ok) {
      return fail({ code: "VALIDATION_ERROR", message: "Invalid export request." }, 400);
    }
    const parsed = exportRequestSchema.safeParse(requestBody.value);
    if (!parsed.success) {
      return fail({ code: "VALIDATION_ERROR", message: "Invalid export request." }, 400);
    }
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
