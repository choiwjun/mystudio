import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settingsSpecSource = readFileSync("specs/screens/settings.yaml", "utf8");
const userFlowSource = readFileSync("docs/planning/03-user-flow.md", "utf8");
const companyProfileFormSource = readFileSync("components/CompanyProfileForm.tsx", "utf8");
const hqPageSource = readFileSync("app/(app)/page.tsx", "utf8");
const hqSetupCompletionNoticeSource = readFileSync(
  "components/hq/HqSetupCompletionNotice.tsx",
  "utf8",
);

describe("settings screen contract", () => {
  it("keeps the first-run guard aligned with settings.yaml and user-flow E1", () => {
    expect(settingsSpecSource).toContain("first_run_guard");
    expect(settingsSpecSource).toContain("require_company_name");
    expect(settingsSpecSource).toContain("require_at_least_one_primary_category");
    expect(settingsSpecSource).toContain("cancel_changes");
    expect(userFlowSource).toContain("설정 저장 → HQ로 자동 리디렉트");
    expect(userFlowSource).toContain("설정 완료! Hermes 스캔 시작");

    expect(companyProfileFormSource).toContain("companyProfileResponseSchema");
    expect(companyProfileFormSource).toContain("companyProfileResponseSchema.parse");
    expect(companyProfileFormSource).toContain("sessionResponseSchema");
    expect(companyProfileFormSource).toContain("csrf_token: z.string().min(1)");
    expect(companyProfileFormSource).toContain('fetch("/api/auth/session")');
    expect(companyProfileFormSource).toContain('setStatus("세션 확인 실패")');
    expect(companyProfileFormSource).toContain("canSaveProfile");
    expect(companyProfileFormSource).toContain("profile.company_name.trim().length > 0");
    expect(companyProfileFormSource).toContain("profile.primary_categories.length > 0");
    expect(companyProfileFormSource).toContain('csrfToken !== ""');
    expect(companyProfileFormSource).toContain("disabled={!canSaveProfile");
    expect(companyProfileFormSource).toContain("const wasSetupRequired = lastSaved.setup_required");
    expect(companyProfileFormSource).toContain('window.location.assign("/?setup=complete")');
    expect(companyProfileFormSource).toContain('"x-csrf-token": csrfToken');
    expect(companyProfileFormSource).not.toContain("Authorization");
    expect(companyProfileFormSource).not.toContain("Bearer");
    expect(companyProfileFormSource).toContain("취소");
    expect(companyProfileFormSource).not.toContain("초기화");
  });

  it("shows the HQ completion notice after first-run settings save", () => {
    expect(hqPageSource).toContain("HqSetupCompletionNotice");
    expect(hqSetupCompletionNoticeSource).toContain("URLSearchParams");
    expect(hqSetupCompletionNoticeSource).toContain("setup");
    expect(hqSetupCompletionNoticeSource).toContain("complete");
    expect(hqSetupCompletionNoticeSource).toContain("설정 완료! Hermes 스캔 시작");
    expect(hqSetupCompletionNoticeSource).toContain("history.replaceState");
  });
});
