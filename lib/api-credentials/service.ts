import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { type ApiCredential, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const apiCredentialProviders = [
  "openai",
  "claude",
  "naver",
  "instagram",
  "threads",
  "x",
] as const;
export const apiCredentialStatuses = ["active", "paused"] as const;

export const apiCredentialCreateSchema = z.object({
  provider: z.enum(apiCredentialProviders),
  label: z.string().trim().min(1).max(120),
  secret: z.string().trim().min(1).max(4096),
  status: z.enum(apiCredentialStatuses).default("active"),
});

export const apiCredentialPatchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  secret: z.string().trim().min(1).max(4096).optional(),
  status: z.enum(apiCredentialStatuses).optional(),
  mark_validated: z.boolean().optional(),
});

export type SerializedApiCredential = {
  readonly id: string;
  readonly provider: (typeof apiCredentialProviders)[number];
  readonly label: string;
  readonly status: (typeof apiCredentialStatuses)[number];
  readonly last_validated_at: string | null;
  readonly secret_preview: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type EncryptedSecret = {
  readonly encryptedValue: string;
  readonly iv: string;
  readonly authTag: string;
};

export class ApiCredentialEncryptionSecretMissingError extends Error {
  constructor() {
    super("API_CREDENTIAL_ENCRYPTION_SECRET is required in production.");
    this.name = "ApiCredentialEncryptionSecretMissingError";
  }
}

function credentialSecret(): string {
  const value =
    process.env["API_CREDENTIAL_ENCRYPTION_SECRET"] ??
    process.env["NEXTAUTH_SECRET"] ??
    process.env["AUTH_SECRET"];
  if (value !== undefined && value.trim() !== "") {
    return value;
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new ApiCredentialEncryptionSecretMissingError();
  }
  return "paperclip-local-api-credential-secret";
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(credentialSecret()).digest();
}

function encryptSecret(secret: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptSecret(
  credential: Pick<ApiCredential, "encryptedValue" | "iv" | "authTag">,
): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(credential.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(credential.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(credential.encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function parseProvider(provider: string): SerializedApiCredential["provider"] {
  const parsed = z.enum(apiCredentialProviders).safeParse(provider);
  return parsed.success ? parsed.data : "openai";
}

function parseStatus(status: string): SerializedApiCredential["status"] {
  const parsed = z.enum(apiCredentialStatuses).safeParse(status);
  return parsed.success ? parsed.data : "paused";
}

function secretPreview(secret: string): string {
  if (secret.length <= 8) {
    return "저장됨";
  }
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function serializeApiCredential(credential: ApiCredential): SerializedApiCredential {
  return {
    id: credential.id,
    provider: parseProvider(credential.provider),
    label: credential.label,
    status: parseStatus(credential.status),
    last_validated_at: credential.lastValidatedAt?.toISOString() ?? null,
    secret_preview: secretPreview(decryptSecret(credential)),
    created_at: credential.createdAt.toISOString(),
    updated_at: credential.updatedAt.toISOString(),
  };
}

export async function listApiCredentials(): Promise<SerializedApiCredential[]> {
  const credentials = await prisma.apiCredential.findMany({
    orderBy: [{ provider: "asc" }, { updatedAt: "desc" }],
  });
  return credentials.map(serializeApiCredential);
}

export async function createApiCredential(
  input: z.infer<typeof apiCredentialCreateSchema>,
): Promise<SerializedApiCredential> {
  const encrypted = encryptSecret(input.secret);
  const credential = await prisma.apiCredential.create({
    data: {
      provider: input.provider,
      label: input.label,
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      status: input.status,
    },
  });
  return serializeApiCredential(credential);
}

export async function updateApiCredential(
  id: string,
  input: z.infer<typeof apiCredentialPatchSchema>,
): Promise<SerializedApiCredential | null> {
  const encrypted = input.secret === undefined ? null : encryptSecret(input.secret);
  try {
    const credential = await prisma.apiCredential.update({
      where: { id },
      data: {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.mark_validated === true ? { lastValidatedAt: new Date() } : {}),
        ...(encrypted === null
          ? {}
          : {
              encryptedValue: encrypted.encryptedValue,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
            }),
      },
    });
    return serializeApiCredential(credential);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteApiCredential(id: string): Promise<boolean> {
  try {
    await prisma.apiCredential.delete({ where: { id } });
    return true;
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function getActiveApiCredentialSecret(
  provider: (typeof apiCredentialProviders)[number],
): Promise<string | null> {
  const credential = await prisma.apiCredential.findFirst({
    where: { provider, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  return credential === null ? null : decryptSecret(credential);
}
