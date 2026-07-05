import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { generateSearchStructure, searchStructureSchema } from "@/lib/content/searchStructure";

export const POST = withAuthenticatedApi("optimizers.search.structure", async (request) => {
  const parsed = searchStructureSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail({ code: "BAD_REQUEST", message: "content_package_id is required." }, 400);
  }
  const result = await generateSearchStructure(parsed.data);
  if (result === null) {
    return fail({ code: "NOT_FOUND", message: "Content package was not found." }, 404);
  }
  switch (result.kind) {
    case "blocked_by_budget":
      return fail(result.error, 429);
    case "generated":
      return ok({
        search_title: result.search_title,
        h2: result.h2,
        faq: result.faq,
        comparison_table: result.comparison_table,
        draft: result.draft,
      });
  }
});
