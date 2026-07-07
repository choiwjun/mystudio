import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth/session";

const publicPathPrefixes = [
  "/api/auth",
  "/api/health",
  "/login",
  "/favicon.ico",
  "/_next",
] as const;

function isPublicPath(pathname: string): boolean {
  return publicPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasHermesScanCronCredentialAttempt(request: NextRequest): boolean {
  const authorization = request.headers.get("authorization");
  return request.headers.has("x-cron-secret") || /^Bearer\s+.+$/i.test(authorization ?? "");
}

function unauthorizedApiResponse(request: NextRequest): NextResponse {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
        details: {
          path: request.nextUrl.pathname,
        },
      },
      timestamp: new Date().toISOString(),
      request_id: `req_${crypto.randomUUID()}`,
    },
    { status: 401 },
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/api/hermes/scan" && hasHermesScanCronCredentialAttempt(request)) {
    return NextResponse.next();
  }

  const session = await readSessionFromRequest(request);
  if (session !== null) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return unauthorizedApiResponse(request);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
