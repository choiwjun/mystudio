import Link from "next/link";
import { summarizePerformance, summarizeRevenue } from "@/lib/performance/metrics";
import { getReportIntelligence, type ReportInsight } from "@/lib/reports/service";

type ReportSummaryProps = {
  readonly title: string;
  readonly description: string;
  readonly horizonLabel: string;
};

const emptyRevenueSummary = summarizeRevenue([], 0);
const emptyPerformanceSummary = {
  performance_logs: [],
  recent_content_packages: [],
  summary: summarizePerformance([]),
};

const emptyInsight = {
  title: "데이터 학습 중",
  detail: "성과와 수익 기록이 쌓이면 자동으로 리포트 판단을 제공합니다.",
  action: "발행 후 조회, 클릭, 직접 수익을 먼저 기록하세요.",
} satisfies ReportInsight;

function InsightList({ items }: { readonly items: readonly ReportInsight[] }) {
  if (items.length === 0) {
    return <p className="muted">아직 추천할 항목이 없습니다.</p>;
  }
  return (
    <div className="dashboard-grid">
      {items.map((item) => (
        <article className="metric-card" key={`${item.title}-${item.action}`}>
          <span className="metric-label">{item.title}</span>
          <p>{item.detail}</p>
          <span className="muted">{item.action}</span>
        </article>
      ))}
    </div>
  );
}

export async function ReportSummary({ title, description, horizonLabel }: ReportSummaryProps) {
  const reportData = await getReportIntelligence()
    .then((intelligence) => ({
      intelligence,
      unavailable: false,
    }))
    .catch(() => {
      return {
        intelligence: {
          revenue: emptyRevenueSummary,
          performance: emptyPerformanceSummary,
          weekly_review: emptyInsight,
          monthly_pnl: emptyInsight,
          next_month_calendar: [],
          paperclip_strategy: [],
          product_revenue_dashboard: [],
          content_roi: [],
          rewrite_recommendations: [],
          link_refresh_recommendations: [],
        },
        unavailable: true,
      };
    });
  const { intelligence, unavailable } = reportData;
  const { revenue, performance } = intelligence;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">{title}</h1>
          <div className="muted">{description}</div>
        </div>
      </header>
      {unavailable ? (
        <section className="section-block">
          <h2>데이터 연결 필요</h2>
          <p className="muted">
            현재 데이터베이스에 연결할 수 없어 리포트 수치를 0으로 표시합니다. DB 연결 후 성과와
            수익 데이터를 다시 불러옵니다.
          </p>
        </section>
      ) : null}
      <section className="report-metric-grid">
        <article className="metric-card">
          <span className="metric-label">{horizonLabel} 수익</span>
          <strong>{revenue.month_total.toLocaleString("ko-KR")}원</strong>
          <span className="muted">월 목표 대비 {revenue.progress_rate}%</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">평균 조회</span>
          <strong>{performance.summary.average_views.toLocaleString("ko-KR")}</strong>
          <span className="muted">최근 주간 성과 기준</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">평균 클릭</span>
          <strong>{performance.summary.average_clicks.toLocaleString("ko-KR")}</strong>
          <span className="muted">
            최고 후킹: {performance.summary.best_hook_type ?? "학습 중"}
          </span>
        </article>
      </section>
      <section className="section-block">
        <h2>Paperclip 운영 판단</h2>
        <div className="dashboard-grid">
          <article className="metric-card">
            <span className="metric-label">{intelligence.weekly_review.title}</span>
            <p>{intelligence.weekly_review.detail}</p>
            <span className="muted">{intelligence.weekly_review.action}</span>
          </article>
          <article className="metric-card">
            <span className="metric-label">{intelligence.monthly_pnl.title}</span>
            <p>{intelligence.monthly_pnl.detail}</p>
            <span className="muted">{intelligence.monthly_pnl.action}</span>
          </article>
          {intelligence.paperclip_strategy.map((item) => (
            <article className="metric-card" key={item.title}>
              <span className="metric-label">{item.title}</span>
              <p>{item.detail}</p>
              <span className="muted">{item.action}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="section-block">
        <h2>글별 ROI</h2>
        {intelligence.content_roi.length === 0 ? (
          <p className="muted">아직 글별 ROI를 계산할 수 있는 성과 데이터가 없습니다.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>콘텐츠</th>
                  <th>상태</th>
                  <th>조회</th>
                  <th>클릭</th>
                  <th>수익</th>
                  <th>1천 조회당 수익</th>
                </tr>
              </thead>
              <tbody>
                {intelligence.content_roi.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.status}</td>
                    <td>{row.views.toLocaleString("ko-KR")}</td>
                    <td>{row.clicks.toLocaleString("ko-KR")}</td>
                    <td>{row.revenue.toLocaleString("ko-KR")}원</td>
                    <td>{row.revenue_per_1000_views.toLocaleString("ko-KR")}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="section-block">
        <h2>Rewrite 추천</h2>
        <InsightList items={intelligence.rewrite_recommendations} />
      </section>
      <section className="section-block">
        <h2>링크 갱신 추천</h2>
        <InsightList items={intelligence.link_refresh_recommendations} />
      </section>
      <section className="section-block">
        <h2>다음 달 콘텐츠 캘린더</h2>
        <InsightList items={intelligence.next_month_calendar} />
      </section>
      <section className="section-block">
        <h2>카테고리 수익 순위</h2>
        {revenue.category_rankings.length === 0 ? (
          <p className="muted">아직 카테고리별 수익 데이터가 없습니다.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th>수익</th>
                  <th>샘플</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {revenue.category_rankings.map((item) => (
                  <tr key={item.category}>
                    <td>{item.category}</td>
                    <td>{item.revenue.toLocaleString("ko-KR")}원</td>
                    <td>{item.sample_count.toLocaleString("ko-KR")}</td>
                    <td>
                      <Link
                        className="button"
                        href={`/performance?category=${encodeURIComponent(item.category)}`}
                      >
                        성과 보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="section-block">
        <h2>리포트 바로가기</h2>
        <div className="button-row">
          <Link className="button" href="/reports/daily">
            일간
          </Link>
          <Link className="button" href="/reports/weekly">
            주간
          </Link>
          <Link className="button" href="/reports/monthly">
            월간
          </Link>
        </div>
      </section>
    </>
  );
}
