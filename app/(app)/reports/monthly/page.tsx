import { ReportSummary } from "@/components/reports/ReportSummary";

export const dynamic = "force-dynamic";

export default function MonthlyReportPage() {
  return (
    <ReportSummary
      description="월 목표 대비 수익, 카테고리 기여도, 다음 달 개선 포인트를 확인합니다."
      horizonLabel="이번 달"
      title="월간 리포트"
    />
  );
}
