import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { withAuthenticatedApi } from "@/lib/auth/guards";
import { validateOwnerCredentials } from "@/lib/auth/owner";
import { verifyPasswordHash } from "@/lib/auth/password";
import { getLoginLock, recordLoginFailure, resetLoginAttemptsForTests } from "@/lib/auth/rateLimit";
import { createOwnerSession, readSessionFromRequest, sessionCookieName } from "@/lib/auth/session";
import { isCompanyProfileComplete, serializeCompanyProfile } from "@/lib/company-profile/service";
import { proxy } from "@/proxy";

const ownerPasswordHash =
  "pbkdf2$sha256$310000$paperclip-example-salt$Nm73P_nLX5Z1vTXAE6Yik62lcGYJZGdxyAMNpc-7cYQ";

beforeEach(() => {
  process.env["NEXTAUTH_SECRET"] = "test-nextauth-secret";
  process.env["OWNER_EMAIL"] = "owner@example.com";
  process.env["OWNER_PASSWORD_HASH"] = ownerPasswordHash;
  process.env["ERROR_LOG_ENABLED"] = "false";
  resetLoginAttemptsForTests();
});

describe("P1 owner authentication", () => {
  it("verifies the configured single-user password hash", () => {
    expect(verifyPasswordHash("paperclip-dev-password", ownerPasswordHash)).toBe(true);
    expect(verifyPasswordHash("wrong-password", ownerPasswordHash)).toBe(false);
  });

  it("accepts only the configured owner credentials", async () => {
    await expect(
      validateOwnerCredentials({ email: "owner@example.com", password: "paperclip-dev-password" }),
    ).resolves.toEqual({ ok: true, email: "owner@example.com" });

    await expect(
      validateOwnerCredentials({ email: "owner@example.com", password: "wrong" }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
  });

  it("locks a login key for one minute after five failures", () => {
    const now = Date.now();
    for (let index = 0; index < 5; index += 1) {
      recordLoginFailure("owner@example.com::local", now);
    }

    expect(getLoginLock("owner@example.com::local", now + 1).locked).toBe(true);
    expect(getLoginLock("owner@example.com::local", now + 61_000).locked).toBe(false);
  });

  it("creates a signed session cookie payload with a csrf token", async () => {
    const { token, session } = await createOwnerSession("owner@example.com");
    const request = new Request("http://localhost/api/auth/session", {
      headers: { cookie: `${sessionCookieName}=${encodeURIComponent(token)}` },
    });

    await expect(readSessionFromRequest(request)).resolves.toMatchObject({
      email: "owner@example.com",
      csrfToken: session.csrfToken,
    });
  });

  it("rejects expired sessions", async () => {
    const token = await new SignJWT({
      email: "owner@example.com",
      name: "Owner",
      csrfToken: "csrf",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("owner")
      .setIssuedAt()
      .setExpirationTime("-1s")
      .sign(new TextEncoder().encode("test-nextauth-secret"));

    const request = new Request("http://localhost/api/auth/session", {
      headers: { cookie: `${sessionCookieName}=${encodeURIComponent(token)}` },
    });

    await expect(readSessionFromRequest(request)).resolves.toBeNull();
  });

  it("protects APIs through middleware with the canonical 401 envelope", async () => {
    const request = new NextRequest("http://localhost/api/company-profile");
    const response = await proxy(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("requires csrf for authenticated state-changing API handlers", async () => {
    const { token } = await createOwnerSession("owner@example.com");
    const handler = withAuthenticatedApi("test.patch", () => Response.json({ ok: true }));
    const request = new NextRequest("http://localhost/api/company-profile", {
      method: "PATCH",
      headers: { cookie: `${sessionCookieName}=${encodeURIComponent(token)}` },
    });
    const response = await handler(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("CSRF_TOKEN_INVALID");
  });
});

describe("P1 company profile contract", () => {
  it("marks Hermes and Content setup as incomplete until name and one category exist", () => {
    expect(isCompanyProfileComplete({ companyName: "", primaryCategories: ["자취"] })).toBe(false);
    expect(isCompanyProfileComplete({ companyName: "Paperclip", primaryCategories: [] })).toBe(
      false,
    );
    expect(
      isCompanyProfileComplete({ companyName: "Paperclip", primaryCategories: ["자취"] }),
    ).toBe(true);
  });

  it("serializes company_profile in the resource contract shape", () => {
    const serialized = serializeCompanyProfile({
      id: "profile_1",
      workspaceId: "default_workspace",
      companyName: "Paperclip",
      primaryCategories: ["자취"],
      blockedCategories: ["의료"],
      toneRules: "신뢰감 있게",
      contentPrinciples: "출처 명시",
      revenueGoalMonthly: 500000,
      createdAt: new Date("2026-07-05T00:00:00.000Z"),
      updatedAt: new Date("2026-07-05T01:00:00.000Z"),
    });

    expect(serialized).toEqual({
      id: "profile_1",
      company_name: "Paperclip",
      primary_categories: ["자취"],
      blocked_categories: ["의료"],
      tone_rules: "신뢰감 있게",
      content_principles: "출처 명시",
      revenue_goal_monthly: 500000,
      updated_at: "2026-07-05T01:00:00.000Z",
      setup_required: false,
    });
  });
});
