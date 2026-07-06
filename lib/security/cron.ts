import { timingSafeEqual } from "node:crypto";
import { fail } from "@/lib/api/response";

export type CronGuardResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly response: Response };

const textEncoder = new TextEncoder();

function constantTimeEqualEncoded(received: string, expected: string): boolean {
  const receivedBytes = textEncoder.encode(received);
  const expectedBytes = textEncoder.encode(expected);
  const paddedLength = Math.max(receivedBytes.length, expectedBytes.length);
  const paddedReceived = new Uint8Array(paddedLength);
  const paddedExpected = new Uint8Array(paddedLength);

  paddedReceived.set(receivedBytes);
  paddedExpected.set(expectedBytes);

  return (
    timingSafeEqual(Buffer.from(paddedReceived), Buffer.from(paddedExpected)) &&
    receivedBytes.length === expectedBytes.length
  );
}

function readBearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization === null) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function readCronSecrets(headers: Headers): readonly string[] {
  return [readBearerToken(headers), headers.get("x-cron-secret")].filter(
    (secret): secret is string => secret !== null,
  );
}

export function hasCronCredentialAttempt(headers: Headers): boolean {
  return readCronSecrets(headers).length > 0;
}

export function verifyCronSecret(
  headers: Headers,
  expectedSecret: string | undefined,
): CronGuardResult {
  if (!expectedSecret) {
    return {
      allowed: false,
      response: fail(
        {
          code: "CRON_SECRET_NOT_CONFIGURED",
          message: "CRON_SECRET is required before enabling cron endpoints.",
        },
        500,
      ),
    };
  }

  const receivedSecrets = readCronSecrets(headers);
  const hasMatchingSecret = receivedSecrets.some((receivedSecret) =>
    constantTimeEqualEncoded(receivedSecret, expectedSecret),
  );
  if (!hasMatchingSecret) {
    return {
      allowed: false,
      response: fail(
        {
          code: "UNAUTHORIZED",
          message:
            "Cron endpoint requires a valid Authorization Bearer or x-cron-secret credential.",
        },
        401,
      ),
    };
  }

  return { allowed: true };
}
