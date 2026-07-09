import { ReportSummary } from "@/components/reports/ReportSummary";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <ReportSummary
      description="일간·주간·월간 성과와 수익 목표를 한곳에서 확인합니다."
      horizonLabel="이번 달"
      title="리포트"
    />
  );
}
