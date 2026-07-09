import Link from "next/link";
import { listContentPackages } from "@/lib/content/service";
import { canUseMissingDatabaseFallback } from "@/lib/db";

export const dynamic = "force-dynamic";

function normalizeProgress(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  const percent = value <= 1 ? value * 100 : value;
  return Math.round(Math.min(Math.max(percent, 0), 100));
}

async function loadContentPackages() {
  try {
    return await listContentPackages(null);
  } catch (error: unknown) {
    if (canUseMissingDatabaseFallback(error)) {
      return [];
    }
    throw error;
  }
}

export default async function ContentPackagesPage() {
  const contentPackages = await loadContentPackages();

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">콘텐츠 제작</h1>
          <div className="muted">블로그 콘텐츠, SNS 변환 준비, 제작 상태</div>
        </div>
      </header>

      <section aria-labelledby="content-packages-title">
        <h2 id="content-packages-title">콘텐츠 패키지</h2>
        {contentPackages.length === 0 ? (
          <article className="card">
            <h3>아직 제작 중인 콘텐츠 패키지가 없습니다.</h3>
            <p className="muted">HQ에서 기회를 선택하면 콘텐츠 제작 패키지가 생성됩니다.</p>
            <Link className="button primary" href="/">
              HQ로 돌아가기
            </Link>
          </article>
        ) : (
          <div className="metric-grid">
            {contentPackages.map((contentPackage) => {
              const progress = normalizeProgress(contentPackage.progress);
              return (
                <article className="card" key={contentPackage.id}>
                  <h3>{contentPackage.topic.title}</h3>
                  <p className="muted">{contentPackage.topic.description ?? "설명 없음"}</p>
                  <p>
                    <span className="badge">{contentPackage.status}</span>
                  </p>
                  {progress === null ? (
                    <p className="muted">
                      진행 미측정 · 발행 준비도 {contentPackage.publish_readiness ?? "미평가"}
                    </p>
                  ) : (
                    <>
                      <progress
                        aria-label={`${contentPackage.topic.title} 진행률 ${progress}%`}
                        className="progress-meter"
                        max={100}
                        value={progress}
                      />
                      <p className="muted">
                        진행 {progress}% · 발행 준비도{" "}
                        {contentPackage.publish_readiness ?? "미평가"}
                      </p>
                    </>
                  )}
                  <Link className="button" href={`/packages/${contentPackage.id}`}>
                    패키지 열기
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
