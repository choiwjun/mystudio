import { AppHeaderActions } from "@/components/AppHeaderActions";

function formatKoreanDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function AppHeader() {
  return (
    <header className="app-header">
      <div>
        <div className="brand">Paperclip Company OS</div>
        <div className="muted">{formatKoreanDate(new Date())} · Status Focus</div>
      </div>
      <AppHeaderActions />
    </header>
  );
}
