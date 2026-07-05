import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { maskSensitiveContext } from "@/lib/security/mask";
import { isPrivateAddress } from "@/lib/security/productImport";

const schema = readFileSync("prisma/schema.prisma", "utf8");

function sourceFilesUnder(path: string): readonly string[] {
  return readdirSync(path).flatMap((entry) => {
    const childPath = `${path}/${entry}`;
    const stat = statSync(childPath);
    if (stat.isDirectory()) {
      return sourceFilesUnder(childPath);
    }
    return childPath.endsWith(".ts") || childPath.endsWith(".tsx") ? [childPath] : [];
  });
}

describe("P0 database contract", () => {
  it("includes the 28 Prisma models required by the planning document", () => {
    const modelCount = Array.from(schema.matchAll(/^model\s+\w+\s+\{/gm)).length;
    expect(modelCount).toBe(28);
  });

  it("keeps body_markdown as the stored draft canonical content and excludes body_html", () => {
    expect(schema).toContain("bodyMarkdown");
    expect(schema).toContain('@map("body_markdown")');
    expect(schema).not.toContain("bodyHtml");
    expect(schema).not.toContain("body_html");
  });

  it("keeps PackageStatus aligned with the v0.7 state machine source", () => {
    for (const status of [
      "opportunity_found",
      "owner_approval_required",
      "published_manually",
      "needs_link_refresh",
      "low_homefeed_fit",
    ]) {
      expect(schema).toContain(status);
    }
  });

  it("routes content package status mutations through the transition service", () => {
    const forbiddenCallSites = sourceFilesUnder("lib")
      .filter((path) => path !== "lib/content/repository.ts")
      .filter((path) => /(?:prisma|tx)\.contentPackage\.update\(/.test(readFileSync(path, "utf8")));

    expect(forbiddenCallSites).toEqual([]);
  });

  it("uses enums for decision and export format drift points", () => {
    expect(schema).toContain("enum DecisionValue");
    expect(schema).toContain("enum ExportFormat");
    expect(schema).toContain("decision              DecisionValue");
    expect(schema).toContain("format           ExportFormat");
    expect(schema).not.toContain("json\n");
  });
});

describe("P0 API and security infrastructure", () => {
  it("returns the unified success and error envelope shape", () => {
    const success = apiSuccess({ ready: true }, "req_test");
    const failure = apiFailure(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      "req_test",
    );

    expect(success).toMatchObject({
      success: true,
      data: { ready: true },
      error: null,
      request_id: "req_test",
    });
    expect(failure).toMatchObject({
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED" },
      request_id: "req_test",
    });
  });

  it("masks sensitive logging context fields before persistence", () => {
    const masked = maskSensitiveContext({
      email: "owner@example.com",
      password: "plain",
      nested: {
        authorization: "Bearer secret",
        safe: "visible",
      },
    });

    expect(masked).toEqual({
      email: "owner@example.com",
      password: "[MASKED]",
      nested: {
        authorization: "[MASKED]",
        safe: "visible",
      },
    });
  });

  it("detects private import target addresses for SSRF defense", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.0.0.5")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.20")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});
