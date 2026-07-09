import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apiFailure, apiSuccess, fail, ok, runWithRequestId } from "@/lib/api/response";
import { maskSensitiveContext } from "@/lib/security/mask";
import { isPrivateAddress } from "@/lib/security/productImport";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const apiHandlerSource = readFileSync("lib/api/handler.ts", "utf8");
const apiRequestLoggerSource = readFileSync("lib/logging/apiRequestLogger.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};
const biomeConfig = JSON.parse(readFileSync("biome.json", "utf8")) as {
  readonly files?: {
    readonly includes?: readonly string[];
  };
};

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
  it("includes the 32 Prisma models required by the planning document and operations expansion", () => {
    const modelCount = Array.from(schema.matchAll(/^model\s+\w+\s+\{/gm)).length;
    expect(modelCount).toBe(32);
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
  it("persists API response timing separately from content performance logs", () => {
    expect(schema).toContain("model ApiRequestLog");
    expect(schema).toContain('@@map("api_request_logs")');
    expect(apiRequestLoggerSource).toContain("prisma.apiRequestLog.create");
    expect(apiHandlerSource).toContain("recordApiRequestLog");
    expect(apiHandlerSource).toContain("x-response-time-ms");
  });

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

  it("reuses request-scoped ids for success and error responses", async () => {
    const [success, failure] = await runWithRequestId("req_scoped", async () => {
      const successPayload = await ok({ ready: true }).json();
      const failurePayload = await fail(
        { code: "VALIDATION_ERROR", message: "Invalid request." },
        400,
      ).json();
      return [successPayload, failurePayload] as const;
    });

    expect(success.request_id).toBe("req_scoped");
    expect(failure.request_id).toBe("req_scoped");
  });

  it("masks sensitive logging context fields before persistence", () => {
    const masked = maskSensitiveContext({
      email: "owner@example.com",
      password: "plain",
      apiKey: "provider-secret",
      nested: {
        authorization: "Bearer secret",
        clientApiKey: "nested-secret",
        safe: "visible",
      },
    });

    expect(masked).toEqual({
      email: "owner@example.com",
      password: "[MASKED]",
      apiKey: "[MASKED]",
      nested: {
        authorization: "[MASKED]",
        clientApiKey: "[MASKED]",
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

describe("P0 dependency hygiene contract", () => {
  it("pins top-level dependencies and removes unused auth/sanitizer/logger packages", () => {
    const dependencies = packageJson.dependencies ?? {};
    const devDependencies = packageJson.devDependencies ?? {};
    const allTopLevelVersions = [...Object.values(dependencies), ...Object.values(devDependencies)];

    expect(allTopLevelVersions).not.toContain("latest");
    expect(dependencies).not.toHaveProperty("dompurify");
    expect(dependencies).not.toHaveProperty("pino");
    expect(dependencies).not.toHaveProperty("next-auth");
    expect(dependencies["ky"]).toBe("1.14.0");
  });

  it("keeps lint and format coverage on UI and auth boundary files", () => {
    const includes = biomeConfig.files?.includes ?? [];

    expect(includes).toContain("components/**/*");
    expect(includes).toContain("proxy.ts");
    expect(includes).toContain("playwright.config.ts");
  });
});
