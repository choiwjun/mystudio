import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const departmentNavSource = readFileSync("components/DepartmentNav.tsx", "utf8");
const compliancePageSource = readFileSync("app/(app)/compliance/page.tsx", "utf8");
const packagesPageSource = readFileSync("app/(app)/packages/page.tsx", "utf8");
const appHeaderActionsSource = readFileSync("components/AppHeaderActions.tsx", "utf8");
const designSystemSource = readFileSync("docs/planning/05-design-system.md", "utf8");
const tasksSource = readFileSync("docs/planning/06-tasks.md", "utf8");
const screenIndexSource = readFileSync("specs/screens/index.yaml", "utf8");
const globalsCssSource = readFileSync("app/globals.css", "utf8");

describe("G010 UX navigation and design contract", () => {
  it("routes production Content Factory entry points to real packages instead of demo data", () => {
    expect(departmentNavSource).toContain('href: "/packages"');
    expect(departmentNavSource).toContain('match: "prefix"');
    expect(departmentNavSource).not.toContain("/packages/demo");
    expect(departmentNavSource).not.toContain('href: "/settings"');

    expect(compliancePageSource).toContain('href: "/packages"');
    expect(compliancePageSource).toContain('href="/packages"');
    expect(compliancePageSource).not.toContain("/packages/demo");
    expect(compliancePageSource).not.toContain("/settings");

    expect(appHeaderActionsSource).toContain('href="/settings"');
  });

  it("provides a production packages index backed by persisted content packages", () => {
    expect(packagesPageSource).toContain('import Link from "next/link"');
    expect(packagesPageSource).toContain(
      'import { listContentPackages } from "@/lib/content/service"',
    );
    expect(packagesPageSource).toContain("listContentPackages(null)");
    expect(packagesPageSource).toContain("href={`/packages/");
    expect(packagesPageSource).toContain("contentPackage.id");
    expect(packagesPageSource).toContain("contentPackage.publish_readiness");
    expect(packagesPageSource).toContain("normalizeProgress");
    expect(packagesPageSource).toContain("진행 미측정");
    expect(packagesPageSource).not.toContain('return "0%"');
    expect(packagesPageSource).toContain("HQ로 돌아가기");
    expect(packagesPageSource).not.toContain("/packages/demo");
  });

  it("keeps docs and specs aligned to the implemented dark command-center navigation", () => {
    for (const token of [
      "--surface-base: #08090a",
      "--surface-panel: #0f1011",
      "--surface-card: #191a1b",
      "--surface-raised: #28282c",
      "--text-primary: #f7f8f8",
      "--accent-primary: #7170ff",
    ]) {
      expect(designSystemSource).toContain(token);
      expect(globalsCssSource).toContain(token);
    }
    expect(designSystemSource).toContain("color-scheme: dark");

    expect(designSystemSource).not.toContain("#F7F8FA");
    expect(designSystemSource).not.toContain("#FFFFFF (흰색)");
    expect(tasksSource).toContain("production 사이드바 링크는 `/packages` 콘텐츠 인덱스를 사용");
    expect(tasksSource).toContain("`/packages/demo`는 개발/데모 확인용 상세 id");
    expect(screenIndexSource).toContain("- /packages");
    expect(screenIndexSource).toContain("header_routes:");
    expect(screenIndexSource).toContain("- /settings");
    expect(screenIndexSource).toContain("development_only_routes:");
    expect(screenIndexSource).toContain("- /packages/demo");
  });
});
