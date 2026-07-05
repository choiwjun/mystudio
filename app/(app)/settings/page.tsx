import { CompanyProfileForm } from "@/components/CompanyProfileForm";

export default function SettingsPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">Settings</h1>
          <div className="muted">회사 정보, 카테고리, 금지 단어, 톤 설정</div>
        </div>
      </header>
      <CompanyProfileForm />
    </>
  );
}
