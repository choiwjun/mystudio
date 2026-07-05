import { ok } from "@/lib/api/response";

export function GET() {
  return ok({
    service: "paperclip-company-os",
    status: "ready",
    checks: {
      apiEnvelope: true,
      prismaSchema: true,
      aiAdapterBoundary: true,
    },
  });
}
