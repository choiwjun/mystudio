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
      readonly reason: "invalid_credentials" | "owner_email_unconfigured" | "password_hash_unconfigured";
    };

export function getOwnerEmail(): string | null {
  const ownerEmail = process.env["OWNER_EMAIL"]?.trim();
  return ownerEmail === undefined || ownerEmail === "" ? null : ownerEmail;
}

export async function validateOwnerCredentials(input: CredentialInput): Promise<CredentialResult> {
  const ownerEmail = getOwnerEmail();
  const passwordHash = process.env["OWNER_PASSWORD_HASH"]?.trim();

  if (ownerEmail === null) {
    return { ok: false, reason: "owner_email_unconfigured" };
  }

  if (passwordHash === undefined || passwordHash === "" || passwordHash === "replace-with-hash") {
    return { ok: false, reason: "password_hash_unconfigured" };
  }

  const expectedEmail = ownerEmail.toLowerCase();
  const emailMatches = input.email.trim().toLowerCase() === expectedEmail;
  const passwordMatches = verifyPasswordHash(input.password, passwordHash);

  if (!emailMatches || !passwordMatches) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return { ok: true, email: expectedEmail };
}
