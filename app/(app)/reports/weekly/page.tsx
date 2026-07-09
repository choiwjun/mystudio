import { ReportSummary } from "@/components/reports/ReportSummary";

export const dynamic = "force-dynamic";

export default function WeeklyReportPage() {
  return (
    <ReportSummary
      description="최근 주간 성과를 보고 홈피드 후킹, 검색 구조, 제휴 배치를 조정합니다."
      horizonLabel="이번 주"
      title="주간 리포트"
    />
  );
}
