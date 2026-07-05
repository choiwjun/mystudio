import { pbkdf2Sync, timingSafeEqual } from "node:crypto";

type ParsedPasswordHash = {
  readonly iterations: number;
  readonly salt: string;
  readonly digest: Buffer;
};

function parsePasswordHash(encodedHash: string): ParsedPasswordHash | null {
  const [scheme, algorithm, iterationsRaw, salt, digestRaw] = encodedHash.split("$");
  if (
    scheme !== "pbkdf2" ||
    algorithm !== "sha256" ||
    salt === undefined ||
    digestRaw === undefined
  ) {
    return null;
  }

  const iterations = Number.parseInt(iterationsRaw ?? "", 10);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) {
    return null;
  }

  return {
    iterations,
    salt,
    digest: Buffer.from(digestRaw, "base64url"),
  };
}

export function verifyPasswordHash(password: string, encodedHash: string): boolean {
  const parsed = parsePasswordHash(encodedHash);
  if (parsed === null) {
    return false;
  }

  const candidate = pbkdf2Sync(
    password,
    parsed.salt,
    parsed.iterations,
    parsed.digest.length,
    "sha256",
  );
  return candidate.length === parsed.digest.length && timingSafeEqual(candidate, parsed.digest);
}
