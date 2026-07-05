"use client";

import ky, { HTTPError } from "ky";
import { useEffect, useMemo, useState } from "react";
import {
  ContentPackageLayout,
  type DetailTab,
  type ExportFormatName,
} from "@/components/content/ContentPackageLayout";
import { demoContentPackage, demoPackageForId } from "@/components/content/demoPackage";
import type {
  DetailComplianceCheck,
  DetailContentPackage,
  DetailDraft,
  DetailExportRecord,
} from "@/components/content/types";
import type { ApiResponse } from "@/lib/api/response";

type ExportPayload = { readonly exports: readonly DetailExportRecord[] };

const fallbackDraft: DetailDraft = {
  id: "empty_draft",
  channel: "naver_blog",
  homefeed_title: [],
  search_title: null,
  thumbnail_text: [],
  first_screen: null,
  body_markdown: "",
  comparison_table: null,
  disclosure_text: null,
  price_notice: null,
  original_body: "",
  updated_at: "2026-07-05T00:00:00.000Z",
};

function firstDraft(packageData: DetailContentPackage): DetailDraft { return packageData.drafts[0] ?? fallbackDraft; }

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

function createDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ContentPackageDetail({ packageId }: { readonly packageId: string }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("preview");
  const [packageData, setPackageData] = useState<DetailContentPackage>(() =>
    demoPackageForId(packageId),
  );
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState("불러오는 중");
  const [draftBody, setDraftBody] = useState(firstDraft(demoContentPackage).body_markdown ?? "");

  const draft = firstDraft(packageData);
  const check = packageData.compliance_checks[0] ?? null;
  const exportAllowed = check?.export_allowed === true;
  const highRisk = check?.risk_level === "high";

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const session = await loadApiData<{ readonly csrf_token: string }>("/api/auth/session");
        setCsrfToken(session.csrf_token);
        const detail = await loadApiData<DetailContentPackage>(`/api/content-packages/${packageId}`);
        setPackageData(detail);
        setDraftBody(firstDraft(detail).body_markdown ?? "");
        setStatus("저장됨");
      } catch (error) {
        if (error instanceof HTTPError && error.response.status === 401) {
          window.location.assign(`/login?from=/packages/${packageId}`);
          return;
        }
        if (error instanceof Error) {
          const demoPackage = demoPackageForId(packageId);
          setPackageData(demoPackage);
          setDraftBody(firstDraft(demoPackage).body_markdown ?? "");
          setStatus("데모 데이터");
          return;
        }
        throw error;
      }
    }

    void load();
  }, [packageId]);

  useEffect(() => {
    if (draft.id === "demo_draft" || draftBody === (draft.body_markdown ?? "")) {
      return;
    }

    const timer = window.setTimeout(() => {
      async function save(): Promise<void> {
        try {
          await ky.patch(`/api/drafts/${draft.id}`, {
            headers: { "x-csrf-token": csrfToken },
            json: { body_markdown: draftBody },
          });
          setStatus("자동 저장됨");
        } catch (error) {
          if (error instanceof HTTPError || error instanceof Error) {
            setStatus("자동 저장 실패");
            return;
          }
          throw error;
        }
      }

      void save();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [csrfToken, draft.body_markdown, draft.id, draftBody]);

  const keywordText = useMemo(
    () =>
      packageData.opportunity_memo?.keyword_clusters
        .map((cluster) => cluster.primary_keyword)
        .join(", ") ?? "키워드 클러스터 없음",
    [packageData.opportunity_memo],
  );

  async function runCompliance(): Promise<void> {
    if (draft.id === "demo_draft") {
      setStatus("데모 검수 통과");
      return;
    }
    const check = await postApiData<DetailComplianceCheck>("/api/compliance/check", csrfToken, {
      content_package_id: packageData.id,
      draft_id: draft.id,
    });
    setPackageData((current) => ({
      ...current,
      status: check.export_allowed ? "owner_approval_required" : "compliance_failed",
      compliance_checks: [check, ...current.compliance_checks],
    }));
    setStatus("검수 완료");
  }

  async function applyFixes(checkId: string): Promise<void> {
    if (checkId === "demo_check") {
      setStatus("데모 수정 적용");
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

  async function dismissIssue(issueId: string): Promise<void> {
    if (issueId.startsWith("demo")) {
      setStatus("데모 이슈 무시");
      return;
    }
    await postApiData(`/api/compliance/issues/${issueId}/dismiss`, csrfToken, {
      dismiss_reason: "owner accepted medium or low risk",
    });
    setPackageData((current) => ({
      ...current,
      compliance_checks: current.compliance_checks.map((item) =>
        item.id === check?.id
          ? {
              ...item,
              issues: item.issues.map((issue) =>
                issue.id === issueId ? { ...issue, dismissed_at: new Date().toISOString() } : issue,
              ),
            }
          : item,
      ),
    }));
    setStatus("이슈 무시됨");
  }

  async function exportPackage(format: ExportFormatName): Promise<void> {
    if (!exportAllowed) {
      return;
    }
    if (packageData.id === "demo") {
      setStatus("데모 Export 준비");
      return;
    }
    const payload = await postApiData<ExportPayload>(
      `/api/content-packages/${packageData.id}/export`,
      csrfToken,
    );
    const selectedExport = payload.exports.find((item) => item.format === format);
    if (selectedExport === undefined) {
      setStatus("Export 형식 없음");
      return;
    }
    if (format === "copy") {
      await navigator.clipboard.writeText(selectedExport.content);
      setStatus("복사됨");
      return;
    }
    const extension = format === "markdown" ? "md" : format;
    const mimeType = format === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
    createDownload(`${packageData.topic.title}.${extension}`, selectedExport.content, mimeType);
    setStatus("Export 생성됨");
  }

  async function decide(action: "approve" | "reject"): Promise<void> {
    if (packageData.paperclip_decision_id === "demo_decision") {
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
      check={check}
      draft={draft}
      draftBody={draftBody}
      exportAllowed={exportAllowed}
      highRisk={highRisk}
      keywordText={keywordText}
      onApplyFixes={(checkId) => void applyFixes(checkId)}
      onDecide={(action) => void decide(action)}
      onDismissIssue={(issueId) => void dismissIssue(issueId)}
      onDraftBodyChange={(body) => {
        setDraftBody(body);
        setStatus("자동 저장 대기");
      }}
      onExport={(format) => void exportPackage(format)}
      onRestoreOriginal={() => {
        setDraftBody(draft.original_body ?? "");
        setStatus("원문 복원 대기");
      }}
      onRunCompliance={() => void runCompliance()}
      onTabChange={setActiveTab}
      packageData={packageData}
      status={status}
    />
  );
}
