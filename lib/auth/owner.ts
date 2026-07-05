import { verifyPasswordHash } from "@/lib/auth/password";

export type CredentialInput = {
  readonly email: string;
  readonly password: string;
};

export type CredentialResult =
  | {
      readonly ok: true;
      readonly email: string;
    }
  | {
      readonly ok: false;
      readonly reason: "invalid_credentials" | "password_hash_unconfigured";
    };

export function getOwnerEmail(): string {
  return process.env["OWNER_EMAIL"] ?? "owner@example.com";
}

export async function validateOwnerCredentials(input: CredentialInput): Promise<CredentialResult> {
  const expectedEmail = getOwnerEmail().trim().toLowerCase();
  const passwordHash = process.env["OWNER_PASSWORD_HASH"]?.trim();

  if (passwordHash === undefined || passwordHash === "" || passwordHash === "replace-with-hash") {
    return { ok: false, reason: "password_hash_unconfigured" };
  }

  const emailMatches = input.email.trim().toLowerCase() === expectedEmail;
  const passwordMatches = verifyPasswordHash(input.password, passwordHash);

  if (!emailMatches || !passwordMatches) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return { ok: true, email: expectedEmail };
}
