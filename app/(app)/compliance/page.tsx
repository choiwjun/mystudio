const complianceActions = [
  {
    href: "/packages",
    label: "콘텐츠 패키지 열기",
    title: "검수 게이트",
    text: "본문 마크다운과 대가성 문구를 서버에서 검수하고 내보내기 차단 여부를 확정합니다.",
  },
  {
    href: "/products",
    label: "상품/링크 확인",
    title: "가격·링크 갱신",
    text: "7일 이상 지난 가격과 쇼핑커넥트 링크를 갱신합니다.",
  },
] as const;

export default function CompliancePage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">컴플라이언스</h1>
          <div className="muted">서버 강제 검수 · 고위험 내보내기 차단</div>
        </div>
        <a className="button primary" href="/packages">
          검수 화면 열기
        </a>
      </header>

      <section aria-labelledby="compliance-actions-title">
        <h2 id="compliance-actions-title">검수 작업</h2>
        <div className="metric-grid">
          {complianceActions.map((action) => (
            <article className="card" key={action.title}>
              <h3>{action.title}</h3>
              <p className="muted">{action.text}</p>
              <a className="button" href={action.href}>
                {action.label}
              </a>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
