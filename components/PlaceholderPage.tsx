import Link from "next/link";

type PlaceholderPageProps = {
  readonly title: string;
  readonly description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">{title}</h1>
          <div className="muted">Planned implementation route</div>
        </div>
        <Link className="button" href="/">
          HQ로 돌아가기
        </Link>
      </header>
      <section className="card">
        <h2>{title} 준비 중</h2>
        <p>{description}</p>
        <p className="muted">
          이 화면은 P0 라우팅 검증용 placeholder이며, 해당 Phase에서 실제 기능으로 대체됩니다.
        </p>
      </section>
    </>
  );
}
