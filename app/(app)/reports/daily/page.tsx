import { ReportSummary } from "@/components/reports/ReportSummary";

export const dynamic = "force-dynamic";

export default function DailyReportPage() {
  return (
    <ReportSummary
      description="오늘 게시·클릭·수익 기록을 기준으로 다음 작업 우선순위를 점검합니다."
      horizonLabel="오늘"
      title="일간 리포트"
    />
  );
}
