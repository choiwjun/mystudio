import { HqOpportunityMemoList } from "@/components/hq/HqOpportunityMemoList";

export default function HermesPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">기회 발굴</h1>
          <div className="muted">기회 메모, 4축 점수, 선택/보류/폐기 의사결정</div>
        </div>
      </header>

      <HqOpportunityMemoList />
    </>
  );
}
