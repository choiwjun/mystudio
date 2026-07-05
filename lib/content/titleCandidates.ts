import { z } from "zod";

export const hookTypes = [
  "problem_empathy",
  "mistake_pointing",
  "comparison_choice",
  "checklist",
  "before_after",
  "price_value",
  "seasonal_timing",
] as const;

export const titleCandidateSchema = z.object({
  kind: z.enum(["homefeed", "search", "thumbnail"]),
  text: z.string().min(1),
  hook_type: z.enum(hookTypes).optional(),
  selected: z.boolean(),
});

export type TitleCandidateInput = z.infer<typeof titleCandidateSchema>;

export function createHomefeedTitleCandidates(topic: string): readonly TitleCandidateInput[] {
  const base = topic.trim().length > 0 ? topic.trim() : "오늘의 콘텐츠";
  return [
    {
      kind: "homefeed",
      text: `${base}, 지금 놓치면 후회하는 이유`,
      hook_type: "problem_empathy",
      selected: true,
    },
    {
      kind: "homefeed",
      text: `${base}에서 가장 많이 하는 실수`,
      hook_type: "mistake_pointing",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base} 선택 전 비교할 3가지`,
      hook_type: "comparison_choice",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base} 체크리스트만 따라오세요`,
      hook_type: "checklist",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base} 전후가 달라지는 기준`,
      hook_type: "before_after",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base} 가격값 하는지 보는 법`,
      hook_type: "price_value",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base} 시즌에 먼저 확인할 것`,
      hook_type: "seasonal_timing",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base}를 고르기 전에 버릴 기준`,
      hook_type: "mistake_pointing",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base} 초보자가 바로 쓰는 순서`,
      hook_type: "checklist",
      selected: false,
    },
    {
      kind: "homefeed",
      text: `${base} 비교표로 끝내기`,
      hook_type: "comparison_choice",
      selected: false,
    },
  ];
}

export function createThumbnailCandidates(topic: string): readonly TitleCandidateInput[] {
  const base = topic.trim().length > 0 ? topic.trim() : "체크";
  return [
    { kind: "thumbnail", text: `${base} 전 확인`, selected: true },
    { kind: "thumbnail", text: "실패 줄이는 기준", selected: false },
    { kind: "thumbnail", text: "가격 기준일 필수", selected: false },
    { kind: "thumbnail", text: "비교 후 선택", selected: false },
    { kind: "thumbnail", text: "오늘 바로 점검", selected: false },
  ];
}

export function hasFullHookCoverage(candidates: readonly TitleCandidateInput[]): boolean {
  const covered = new Set(candidates.map((candidate) => candidate.hook_type).filter(Boolean));
  return hookTypes.every((hookType) => covered.has(hookType));
}
