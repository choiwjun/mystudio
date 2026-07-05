import { HqBriefingPanel } from "@/components/hq/HqBriefingPanel";
import { HqCommandActions } from "@/components/hq/HqCommandActions";
import { HqKanbanBoard } from "@/components/hq/HqKanbanBoard";
import { HqOpportunityMemoList } from "@/components/hq/HqOpportunityMemoList";
import { HqRefreshNeededPanel } from "@/components/hq/HqRefreshNeededPanel";
import { HqRightRailSummary } from "@/components/hq/HqRightRailSummary";
import { HqSetupCompletionNotice } from "@/components/hq/HqSetupCompletionNotice";
import { HqWinningPatternsPanel } from "@/components/hq/HqWinningPatternsPanel";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">Paperclip HQ Command Center</h1>
          <div className="muted">Status Focus · 성과 미기록 1건</div>
        </div>
        <div className="topbar-actions">
          <HqCommandActions />
        </div>
      </header>

      <HqSetupCompletionNotice />

      <section className="dashboard-grid" aria-label="HQ dashboard">
        <div className="stack">
          <HqBriefingPanel />

          <HqOpportunityMemoList />

          <HqKanbanBoard />

          <HqWinningPatternsPanel />
        </div>

        <aside className="stack" aria-label="HQ right rail">
          <HqRightRailSummary />
          <HqRefreshNeededPanel />
        </aside>
      </section>
    </>
  );
}
