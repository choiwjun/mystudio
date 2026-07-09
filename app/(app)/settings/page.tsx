import { CompanyProfileForm } from "@/components/CompanyProfileForm";
import { AiBudgetSettingsPanel } from "@/components/settings/AiBudgetSettingsPanel";
import { ApiCredentialsPanel } from "@/components/settings/ApiCredentialsPanel";

export default function SettingsPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">설정</h1>
          <div className="muted">
            회사 정보, 주요/차단 카테고리, 톤, 콘텐츠 원칙, 월 매출 목표 설정
          </div>
        </div>
      </header>
      <CompanyProfileForm />
      <ApiCredentialsPanel />
      <AiBudgetSettingsPanel />
    </>
  );
}
