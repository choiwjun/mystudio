import { createHomefeedTitleCandidates, hasFullHookCoverage } from "@/lib/content/titleCandidates";
import { prisma } from "@/lib/db";

export async function generateHomefeedTitles(contentPackageId: string, topic: string) {
  const candidates = createHomefeedTitleCandidates(topic);
  await prisma.titleCandidate.deleteMany({
    where: {
      contentPackageId,
      kind: "homefeed",
    },
  });
  await prisma.titleCandidate.createMany({
    data: candidates.map((candidate) => ({
      contentPackageId,
      kind: candidate.kind,
      text: candidate.text,
      hookType: candidate.hook_type ?? null,
      selected: candidate.selected,
    })),
  });

  return {
    title_candidates: candidates,
    hook_coverage_complete: hasFullHookCoverage(candidates),
  };
}
