import { jwtVerify, SignJWT } from "jose";

export const sessionCookieName = "paperclip_session";
const sessionMaxAgeSeconds = 60 * 60 * 8;

export type OwnerSession = {
  readonly sub: "owner";
  readonly email: string;
  readonly name: "Owner";
  readonly csrfToken: string;
  readonly expiresAt: string;
};

function sessionSecret(): Uint8Array {
  const secret = process.env["NEXTAUTH_SECRET"];
  if (secret === undefined || secret.trim() === "") {
    throw new Error("NEXTAUTH_SECRET is required for session signing.");
  }
  return new TextEncoder().encode(secret);
}

export async function createOwnerSession(email: string): Promise<{
  readonly token: string;
  readonly session: OwnerSession;
  readonly maxAgeSeconds: number;
}> {
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
  const csrfToken = crypto.randomUUID();
  const session: OwnerSession = {
    sub: "owner",
    email,
    name: "Owner",
    csrfToken,
    expiresAt,
  };

  const token = await new SignJWT({
    email: session.email,
    name: session.name,
    csrfToken: session.csrfToken,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds}s`)
    .sign(sessionSecret());

  return { token, session, maxAgeSeconds: sessionMaxAgeSeconds };
}

function readCookie(header: string | null, name: string): string | null {
  if (header === null) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function readSessionToken(token: string | null): Promise<OwnerSession | null> {
  if (token === null || token === "") {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      subject: "owner",
    });

    if (
      payload.sub !== "owner" ||
      typeof payload["email"] !== "string" ||
      typeof payload["name"] !== "string" ||
      typeof payload["csrfToken"] !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      sub: "owner",
      email: payload["email"],
      name: "Owner",
      csrfToken: payload["csrfToken"],
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function readSessionFromRequest(request: Request): Promise<OwnerSession | null> {
  return readSessionToken(readCookie(request.headers.get("cookie"), sessionCookieName));
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
