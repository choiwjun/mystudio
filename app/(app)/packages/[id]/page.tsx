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
          <h1 className="brand">Content Factory</h1>
          <div className="muted">콘텐츠 상세, Markdown 정본, Compliance Gate, Export Bundle</div>
        </div>
      </header>
      <ContentPackageDetail packageId={id} />
    </>
  );
}
