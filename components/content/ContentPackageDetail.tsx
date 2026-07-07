"use client";

import ky, { HTTPError } from "ky";
import { useEffect, useMemo, useState } from "react";
import {
  ContentPackageLayout,
  type DetailTab,
  type ExportFormatName,
} from "@/components/content/ContentPackageLayout";
import { demoContentPackage } from "@/components/content/demoPackage";
import type {
  DetailComplianceCheck,
  DetailComplianceIssue,
  DetailContentPackage,
  DetailDraft,
  DetailExportRecord,
  DetailTitleCandidate,
} from "@/components/content/types";
import type { ApiResponse } from "@/lib/api/response";

type ExportPayload = { readonly exports: readonly DetailExportRecord[] };
type DismissIssuePayload = {
  readonly issue: DetailComplianceIssue;
  readonly compliance_check: DetailComplianceCheck;
};
type GeneratePackagePayload = {
  readonly draft: DetailDraft;
  readonly content_package: DetailContentPackage;
};
type TitleGenerationPayload = {
  readonly title_candidates: readonly DetailTitleCandidate[];
  readonly hook_coverage_complete: boolean;
};
type SearchStructurePayload = {
  readonly search_title: string;
  readonly h2: readonly string[];
  readonly faq: DetailDraft["faq"];
  readonly comparison_table: string;
  readonly draft: DetailDraft;
};

const fallbackDraft: DetailDraft = {
  id: "empty_draft",
  channel: "naver_blog",
  homefeed_title: [],
  search_title: null,
  thumbnail_text: [],
  first_screen: null,
  body_markdown: "",
  comparison_table: null,
  faq: [],
  disclosure_text: null,
  price_notice: null,
  original_body: "",
  updated_at: "2026-07-05T00:00:00.000Z",
  status: "empty",
};
export const draftRecoveryStoragePrefix = "paperclip:draft-recovery:";

type DraftRecoveryRecord = {
  readonly schemaVersion: 1;
  readonly packageId: string;
  readonly draftId: string;
  readonly bodyMarkdown: string;
  readonly savedAt: string;
};

export function draftRecoveryStorageKey(packageId: string, draftId: string): string {
  return `${draftRecoveryStoragePrefix}${packageId}:${draftId}`;
}

export function createDraftRecoveryRecord(input: {
  readonly packageId: string;
  readonly draftId: string;
  readonly bodyMarkdown: string;
  readonly now?: Date;
}): DraftRecoveryRecord {
  return {
    schemaVersion: 1,
    packageId: input.packageId,
    draftId: input.draftId,
    bodyMarkdown: input.bodyMarkdown,
    savedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function parseDraftRecoveryRecord(
  value: string | null,
  packageId: string,
  draftId: string,
): DraftRecoveryRecord | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !("schemaVersion" in parsed) ||
      !("packageId" in parsed) ||
      !("draftId" in parsed) ||
      !("bodyMarkdown" in parsed) ||
      !("savedAt" in parsed)
    ) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      record["schemaVersion"] !== 1 ||
      record["packageId"] !== packageId ||
      record["draftId"] !== draftId ||
      typeof record["bodyMarkdown"] !== "string" ||
      typeof record["savedAt"] !== "string"
    ) {
      return null;
    }
    return record as DraftRecoveryRecord;
  } catch {
    return null;
  }
}

function saveDraftRecovery(record: DraftRecoveryRecord): void {
  window.localStorage.setItem(
    draftRecoveryStorageKey(record.packageId, record.draftId),
    JSON.stringify(record),
  );
}

function clearDraftRecovery(packageId: string, draftId: string): void {
  window.localStorage.removeItem(draftRecoveryStorageKey(packageId, draftId));
}

function firstDraft(packageData: DetailContentPackage): DetailDraft {
  return packageData.drafts[0] ?? fallbackDraft;
}


export function isExplicitDemoPackageId(packageId: string): boolean {
  return packageId === "demo";
}

export function emptyContentPackageDetail(packageId: string): DetailContentPackage {
  return {
    id: packageId,
    topic: {
      title: "콘텐츠 상세를 불러올 수 없습니다",
      description: "콘텐츠 패키지 API 응답에 실패했습니다.",
    },
    opportunity_memo: null,
    status: "load_failed",
    paperclip_decision_id: "",
    drafts: [],
    compliance_checks: [],
    products: [],
    title_candidates: [],
    shopping_connect_links: [],
    exports: [],
  };
}

function initialPackageForId(packageId: string): DetailContentPackage {
  return isExplicitDemoPackageId(packageId) ? demoContentPackage : emptyContentPackageDetail(packageId);
}

async function loadApiData<T>(url: string): Promise<T> {
  const response = await ky.get(url).json<ApiResponse<T>>();
  if (!response.success || response.data === null) {
    throw new Error("API response failed.");
  }
  return response.data;
}

async function postApiData<T>(url: string, csrfToken: string, json?: object): Promise<T> {
  const response = await ky
    .post(url, {
      headers: { "x-csrf-token": csrfToken },
      ...(json === undefined ? {} : { json }),
    })
    .json<ApiResponse<T>>();
  if (!response.success || response.data === null) {
    throw new Error("API response failed.");
  }
  return response.data;
}

function createDownload(filename: string, content: BlobPart, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}


export function ContentPackageDetail({ packageId }: { readonly packageId: string }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("preview");
  const [packageData, setPackageData] = useState<DetailContentPackage>(() =>
    initialPackageForId(packageId),
  );
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState("불러오는 중");
  const isDemoMode = isExplicitDemoPackageId(packageId);
  const [draftBody, setDraftBody] = useState(
    firstDraft(initialPackageForId(packageId)).body_markdown ?? "",
  );
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);

  const draft = firstDraft(packageData);
  const check = packageData.compliance_checks[0] ?? null;
  const exportAllowed = check?.export_allowed === true;
  const canRunPackageActions =
    !isDemoMode && packageData.status !== "load_failed" && packageData.paperclip_decision_id !== "";

  const searchStructureTransitionStatuses = new Set([
    "selected",
    "assigned",
    "brief_created",
    "homefeed_packaged",
  ]);

  const compliancePassTransitionStatuses = new Set([
    "selected",
    "assigned",
    "brief_created",
    "homefeed_packaged",
    "search_structured",
    "revenue_links_attached",
    "blog_draft_generated",
    "sns_repurposed",
    "compliance_checked",
    "compliance_failed",
  ]);

  const complianceFailTransitionStatuses = new Set([
    "selected",
    "assigned",
    "brief_created",
    "homefeed_packaged",
    "search_structured",
    "revenue_links_attached",
    "blog_draft_generated",
    "sns_repurposed",
    "compliance_checked",
    "owner_approval_required",
  ]);

  function nextSearchStructureStatus(currentStatus: string): string {
    return searchStructureTransitionStatuses.has(currentStatus) ? "search_structured" : currentStatus;
  }

  function nextComplianceStatus(currentStatus: string, allowed: boolean): string {
    if (allowed) {
      return compliancePassTransitionStatuses.has(currentStatus) ? "owner_approval_required" : currentStatus;
    }
    return complianceFailTransitionStatuses.has(currentStatus) ? "compliance_failed" : currentStatus;
  }

  function blockDraftReplacementWhileRecovering(): boolean {
    if (!recoveryAvailable) {
      return false;
    }
    setStatus("로컬 임시본 자동 저장 후 다시 시도");
    return true;
  }

  useEffect(() => {
    async function load(): Promise<void> {
      if (isDemoMode) {
        setPackageData(demoContentPackage);
        setDraftBody(firstDraft(demoContentPackage).body_markdown ?? "");
        setRecoveryAvailable(false);
        setStatus("데모 데이터");
        return;
      }

      setPackageData(emptyContentPackageDetail(packageId));
      setDraftBody("");
      setRecoveryAvailable(false);
      setStatus("불러오는 중");

      try {
        const session = await loadApiData<{ readonly csrf_token: string }>("/api/auth/session");
        setCsrfToken(session.csrf_token);
        const detail = await loadApiData<DetailContentPackage>(`/api/content-packages/${packageId}`);
        setPackageData(detail);
        const loadedDraft = firstDraft(detail);
        const recoveredDraft = parseDraftRecoveryRecord(
          window.localStorage.getItem(draftRecoveryStorageKey(packageId, loadedDraft.id)),
          packageId,
          loadedDraft.id,
        );
        if (recoveredDraft !== null && recoveredDraft.bodyMarkdown !== (loadedDraft.body_markdown ?? "")) {
          setDraftBody(recoveredDraft.bodyMarkdown);
          setRecoveryAvailable(true);
          setStatus("로컬 임시 저장본 복구됨 · 자동 재전송 대기");
          return;
        }
        setDraftBody(loadedDraft.body_markdown ?? "");
        setRecoveryAvailable(false);
        setStatus("저장됨");
        if (recoveredDraft !== null) {
          clearDraftRecovery(packageId, loadedDraft.id);
        }
      } catch (error) {
        if (error instanceof HTTPError && error.response.status === 401) {
          window.location.assign(`/login?from=/packages/${packageId}`);
          return;
        }
        setPackageData(emptyContentPackageDetail(packageId));
        setDraftBody("");
        setRecoveryAvailable(false);
        setStatus("불러오기 실패");
      }
    }

    void load();
  }, [isDemoMode, packageId]);

  useEffect(() => {
    if (isDemoMode || draft.id === "empty_draft" || draftBody === (draft.body_markdown ?? "")) {
      return;
    }

    const timer = window.setTimeout(() => {
      async function save(): Promise<void> {
        try {
          await ky.patch(`/api/drafts/${draft.id}`, {
            headers: { "x-csrf-token": csrfToken },
            json: { body_markdown: draftBody },
          });
          clearDraftRecovery(packageId, draft.id);
          setRecoveryAvailable(false);
          setPackageData((current) => ({
            ...current,
            drafts: current.drafts.map((item) =>
              item.id === draft.id
                ? { ...item, body_markdown: draftBody, updated_at: new Date().toISOString() }
                : item,
            ),
          }));
          setStatus("자동 저장됨");
        } catch (error) {
          if (error instanceof HTTPError || error instanceof Error) {
            try {
              saveDraftRecovery(
                createDraftRecoveryRecord({
                  packageId,
                  draftId: draft.id,
                  bodyMarkdown: draftBody,
                }),
              );
              setRecoveryAvailable(true);
              setStatus("자동 저장 실패 · 로컬 보존됨");
            } catch {
              setRecoveryAvailable(false);
              setStatus("자동 저장 실패 · 로컬 보존 실패");
            }
            if (error instanceof HTTPError && error.response.status === 401) {
              window.location.assign(`/login?from=/packages/${packageId}`);
            }
            return;
          }
          throw error;
        }
      }

      void save();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [csrfToken, draft.body_markdown, draft.id, draftBody, isDemoMode, packageId]);

  const keywordText = useMemo(
    () =>
      packageData.opportunity_memo?.keyword_clusters
        .map((cluster) => cluster.primary_keyword)
        .join(", ") ?? "키워드 클러스터 없음",
    [packageData.opportunity_memo],
  );

  async function generatePackage(): Promise<void> {
    if (!canRunPackageActions) {
      setStatus(isDemoMode ? "데모 패키지는 생성하지 않음" : "생성할 패키지 없음");
      return;
    }
    if (blockDraftReplacementWhileRecovering()) {
      return;
    }
    try {
      setStatus("콘텐츠 생성 중");
      const payload = await postApiData<GeneratePackagePayload>(
        `/api/content-packages/${packageData.id}/generate`,
        csrfToken,
      );
      setPackageData(payload.content_package);
      setDraftBody(payload.draft.body_markdown ?? "");
      setStatus(payload.draft.status ?? payload.content_package.status);
    } catch (error) {
      setStatus(error instanceof HTTPError ? "콘텐츠 생성 실패" : "콘텐츠 생성 실패");
    }
  }

  async function generateTitles(): Promise<void> {
    if (!canRunPackageActions) {
      setStatus(isDemoMode ? "데모 제목 생성 생략" : "제목 생성할 패키지 없음");
      return;
    }
    try {
      setStatus("홈피드 제목 생성 중");
      const payload = await postApiData<TitleGenerationPayload>(
        "/api/optimizers/homefeed/titles",
        csrfToken,
        { content_package_id: packageData.id },
      );
      setPackageData((current) => ({
        ...current,
        title_candidates: payload.title_candidates,
      }));
      setStatus(payload.hook_coverage_complete ? "홈피드 제목 생성됨" : "홈피드 제목 보강 필요");
    } catch (error) {
      setStatus(error instanceof HTTPError ? "홈피드 제목 생성 실패" : "홈피드 제목 생성 실패");
    }
  }

  async function generateSearchStructure(): Promise<void> {
    if (!canRunPackageActions) {
      setStatus(isDemoMode ? "데모 검색 구조 생성 생략" : "검색 구조 생성할 패키지 없음");
      return;
    }
    if (blockDraftReplacementWhileRecovering()) {
      return;
    }
    try {
      setStatus("검색 구조 생성 중");
      const payload = await postApiData<SearchStructurePayload>(
        "/api/optimizers/search/structure",
        csrfToken,
        { content_package_id: packageData.id },
      );
      setPackageData((current) => ({
        ...current,
        status: nextSearchStructureStatus(current.status),
        drafts: [payload.draft, ...current.drafts.filter((item) => item.id !== payload.draft.id)],
      }));
      setDraftBody(payload.draft.body_markdown ?? "");
      setStatus("검색 구조 생성됨");
    } catch (error) {
      setStatus(error instanceof HTTPError ? "검색 구조 생성 실패" : "검색 구조 생성 실패");
    }
  }

  async function runCompliance(): Promise<void> {
    if (draft.id === "empty_draft") {
      setStatus("불러오기 실패");
      return;
    }
    if (isDemoMode) {
      setStatus("데모 검수 통과");
      return;
    }
    const check = await postApiData<DetailComplianceCheck>("/api/compliance/check", csrfToken, {
      content_package_id: packageData.id,
      draft_id: draft.id,
    });
    setPackageData((current) => ({
      ...current,
      status: nextComplianceStatus(current.status, check.export_allowed),
      compliance_checks: [check, ...current.compliance_checks],
    }));
    setStatus("검수 완료");
  }

  async function applyFixes(checkId: string): Promise<void> {
    if (isDemoMode && checkId === "demo_check") {
      setStatus("데모 수정 적용");
      return;
    }
    if (blockDraftReplacementWhileRecovering()) {
      return;
    }
    const fixedDraft = await postApiData<DetailDraft>(
      `/api/compliance/checks/${checkId}/apply-fixes`,
      csrfToken,
    );
    setDraftBody(fixedDraft.body_markdown ?? "");
    setPackageData((current) => ({
      ...current,
      drafts: [fixedDraft, ...current.drafts.filter((item) => item.id !== fixedDraft.id)],
    }));
    setStatus("수정 적용됨");
  }

  async function dismissIssue(issueId: string, dismissReason: string): Promise<void> {
    if (isDemoMode && issueId.startsWith("demo")) {
      setStatus("데모 이슈 무시");
      return;
    }
    const payload = await postApiData<DismissIssuePayload>(
      `/api/compliance/issues/${issueId}/dismiss`,
      csrfToken,
      {
        dismiss_reason: dismissReason,
      },
    );
    setPackageData((current) => ({
      ...current,
      status: nextComplianceStatus(current.status, payload.compliance_check.export_allowed),
      compliance_checks: current.compliance_checks.map((item) =>
        item.id === payload.compliance_check.id ? payload.compliance_check : item,
      ),
    }));
    setStatus("이슈 무시됨");
  }

  async function exportPackage(format: ExportFormatName): Promise<void> {
    if (!exportAllowed) {
      return;
    }
    if (isDemoMode) {
      setStatus("데모 Export 준비");
      return;
    }
    const payload = await postApiData<ExportPayload>(
      `/api/content-packages/${packageData.id}/export`,
      csrfToken,
    );
    setPackageData((current) => ({
      ...current,
      exports: payload.exports,
    }));
    const selectedExport = payload.exports.find((item) => item.format === format);
    if (selectedExport === undefined) {
      setStatus("Export 형식 없음");
      return;
    }
    if (selectedExport.content === undefined) {
      setStatus("Export 내용 없음");
      return;
    }
    if (format === "copy") {
      await navigator.clipboard.writeText(selectedExport.content);
      setStatus("복사됨");
      return;
    }
    if (format === "zip") {
      createDownload(`${packageData.topic.title}.zip`, base64ToArrayBuffer(selectedExport.content), "application/zip");
    } else {
      const extension = format === "markdown" ? "md" : format;
      const mimeType = format === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
      createDownload(`${packageData.topic.title}.${extension}`, selectedExport.content, mimeType);
    }
    setStatus("Export 생성됨");
  }

  async function decide(action: "approve" | "reject"): Promise<void> {
    if (packageData.paperclip_decision_id === "") {
      setStatus("불러오기 실패");
      return;
    }
    if (isDemoMode && packageData.paperclip_decision_id === "demo_decision") {
      setStatus(action === "approve" ? "데모 승인됨" : "데모 반려됨");
      return;
    }
    await ky.post(`/api/hq/decisions/${packageData.paperclip_decision_id}/${action}`, {
      headers: { "x-csrf-token": csrfToken },
    });
    setStatus(action === "approve" ? "승인됨" : "반려됨");
  }

  return (
    <ContentPackageLayout
      activeTab={activeTab}
      canRunPackageActions={canRunPackageActions && !recoveryAvailable}
      check={check}
      draft={draft}
      draftBody={draftBody}
      exportAllowed={exportAllowed}
      keywordText={keywordText}
      onApplyFixes={(checkId) => void applyFixes(checkId)}
      onDecide={(action) => void decide(action)}
      onDismissIssue={(issueId, dismissReason) => void dismissIssue(issueId, dismissReason)}
      onGeneratePackage={() => void generatePackage()}
      onGenerateSearchStructure={() => void generateSearchStructure()}
      onGenerateTitleCandidates={() => void generateTitles()}
      onDraftBodyChange={(body) => {
        setDraftBody(body);
        setStatus("자동 저장 대기");
      }}
      onExport={(format) => void exportPackage(format)}
      onRestoreOriginal={() => {
        if (blockDraftReplacementWhileRecovering()) {
          return;
        }
        setDraftBody(draft.original_body ?? "");
        setStatus("원문 복원 대기");
      }}
      onRunCompliance={() => void runCompliance()}
      onTabChange={setActiveTab}
      packageData={packageData}
      status={recoveryAvailable && !status.includes("로컬") ? `${status} · 로컬 임시본 보존 중` : status}
    />
  );
}
