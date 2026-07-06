import { HqStatusBadge } from "@/components/hq/HqStatusBadge";
import { PerformanceRecorder } from "@/components/performance/PerformanceRecorder";

export default function PerformancePage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">Performance Desk</h1>
          <div className="muted">게시 URL, 조회수, 클릭, 수익, Hook Type 기록</div>
        </div>
        <HqStatusBadge />
      </header>
      <PerformanceRecorder />
    </>
  );
}
