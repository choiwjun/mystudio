import { readJsonBody } from "@/lib/api/json";
import { fail, ok } from "@/lib/api/response";
import {
  apiCredentialCreateSchema,
  createApiCredential,
  listApiCredentials,
} from "@/lib/api-credentials/service";
import { withAuthenticatedApi } from "@/lib/auth/guards";

export const GET = withAuthenticatedApi("api-credentials.list", async () => {
  return ok({ api_credentials: await listApiCredentials() });
});

export const POST = withAuthenticatedApi("api-credentials.create", async (request) => {
  const parsed = apiCredentialCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid API credential payload.",
        details: { issues: parsed.error.flatten().fieldErrors },
      },
      400,
    );
  }

  return ok(await createApiCredential(parsed.data), { status: 201 });
});
