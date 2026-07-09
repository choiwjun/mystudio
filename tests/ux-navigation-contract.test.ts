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
const phase1SidebarRoutes = [
  "/",
  "/hermes",
  "/packages",
  "/packages#sns",
  "/products",
  "/products#links",
  "/products#affiliate-links",
  "/products#accounts",
  "/reports",
  "/reports/daily",
  "/reports/weekly",
  "/reports/monthly",
  "/compliance",
  "/memory",
  "/performance",
];
const hiddenSidebarRoutes = [
  "/hermes/keywords",
  "/hermes/competitors",
  "/compliance/policies",
  "/memory/patterns",
  "/packages/demo",
];

describe("G010 UX navigation and design contract", () => {
  it("routes content production entry points to real packages instead of demo data", () => {
    expect(departmentNavSource).toContain("phase1SidebarDepartments");
    for (const route of phase1SidebarRoutes) {
      expect(departmentNavSource).toContain(`href: "${route}"`);
    }
    for (const route of hiddenSidebarRoutes) {
      expect(departmentNavSource).not.toContain(route);
    }
    for (const visibleLabel of [
      "HQ 지휘실",
      "기회 발굴",
      "콘텐츠 제작",
      "블로그 콘텐츠",
      "SNS 변환",
      "제휴/어필리에이트 수익",
      "제휴 상품",
      "쇼핑커넥트 링크",
      "범용 제휴 링크",
      "제휴 계정",
      "성과 기록",
      "리포트",
      "일간 리포트",
      "주간 리포트",
      "월간 리포트",
      "컴플라이언스",
      "회사 메모리",
    ]) {
      expect(departmentNavSource).toContain(`label: "${visibleLabel}"`);
    }
    for (const englishDepartmentLabel of [
      "Content Factory",
      "Revenue Desk",
      "Compliance",
      "Company Memory",
      "Reports",
    ]) {
      expect(departmentNavSource).not.toContain(`label: "${englishDepartmentLabel}"`);
    }
    expect(departmentNavSource).not.toContain('href: "/settings"');

    expect(compliancePageSource).toContain('href: "/packages"');
    expect(compliancePageSource).toContain('href="/packages"');
    expect(compliancePageSource).not.toContain("/packages/demo");
    expect(compliancePageSource).not.toContain("/settings");

    expect(appHeaderActionsSource).toContain('href="/settings"');
    expect(appHeaderActionsSource).not.toContain('fetch("/api/auth/logout"');
    expect(appHeaderActionsSource).not.toContain('window.location.assign("/login")');
    expect(appHeaderActionsSource).not.toContain("Authorization");
    expect(appHeaderActionsSource).not.toContain("Bearer");
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
    expect(designSystemSource).toContain("Compact:       0px - 900px");
    expect(designSystemSource).toContain("Compact:  최소 44px");
    expect(globalsCssSource).toContain("@media (max-width: 900px)");
    expect(globalsCssSource).toContain("min-height: 44px");

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
