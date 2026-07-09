import { ContentPackageDetail } from "@/components/content/ContentPackageDetail";

type ContentPackagePageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function ContentPackagePage({ params }: ContentPackagePageProps) {
  const { id } = await params;
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">콘텐츠 제작 상세</h1>
          <div className="muted">블로그 정본, 검수 게이트, 내보내기 묶음</div>
        </div>
      </header>
      <ContentPackageDetail packageId={id} />
    </>
  );
}
