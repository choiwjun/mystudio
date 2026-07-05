import { HqWinningPatternsPanel } from "@/components/hq/HqWinningPatternsPanel";

export default function MemoryPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">Company Memory</h1>
          <div className="muted">성과 로그에서 학습한 훅, 상품군, 갱신 후보</div>
        </div>
        <a className="button" href="/performance">
          성과 기록
        </a>
      </header>

      <HqWinningPatternsPanel />
    </>
  );
}
