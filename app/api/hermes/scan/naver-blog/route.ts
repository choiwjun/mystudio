import { z } from "zod";
import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { serializeRawItemInput } from "@/lib/hermes/rawItems";
import { collectHermesSearchRawItems } from "@/lib/hermes/searchProvider";

const naverBlogScanSchema = z.object({
  query: z.string().trim().min(1),
});

export const POST = withAuthenticatedApi("hermes.scan.naver-blog", async (request) => {
  const parsed = naverBlogScanSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "query is required." }, 400);
  }

  const rawItems = await collectHermesSearchRawItems(parsed.data.query, "blog");
  return ok({
    query: parsed.data.query,
    raw_items: rawItems.map(serializeRawItemInput),
  });
});
