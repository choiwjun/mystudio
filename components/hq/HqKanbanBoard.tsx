"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  type ContentPackage,
  contentPackagePatchResponseSchema,
  groupPackages,
  hqTodayResponseSchema,
  type KanbanColumnId,
  type KanbanPackageStatus,
  kanbanColumns,
  normalizeProgress,
  statusLabels,
  updatedAtLabel,
} from "@/components/hq/kanban";

const sessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    csrf_token: z.string().min(1),
  }),
});

type ApiErrorPayload = {
  readonly success?: boolean;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly details?: unknown;
  } | null;
};

function isComplianceTarget(status: KanbanPackageStatus): boolean {
  return status === "compliance_checked";
}

function kanbanSuccessMessage(status: KanbanPackageStatus): string {
  return `상태가 ${statusLabels[status]}로 업데이트되었습니다.`;
}

function kanbanFailureMessage(responseStatus: number, payload: ApiErrorPayload | null): string {
  const errorText = `${payload?.error?.code ?? ""} ${payload?.error?.message ?? ""}`.toLowerCase();
  if (errorText.includes("draft") || errorText.includes("초안")) {
    return "검수를 실행하려면 먼저 초안이 필요합니다.";
  }
  if (
    responseStatus === 400 ||
    responseStatus === 409 ||
    errorText.includes("transition") ||
    errorText.includes("invalid")
  ) {
    return "허용되지 않는 상태 전환입니다. 현재 단계에서 가능한 다음 상태를 선택하세요.";
  }
  return "상태 업데이트에 실패했습니다.";
}

async function readApiErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    const payload: unknown = await response.json();
    if (payload === null || typeof payload !== "object") {
      return null;
    }
    return payload as ApiErrorPayload;
  } catch {
    return null;
  }
}

export function HqKanbanBoard() {
  const [contentPackages, setContentPackages] = useState<readonly ContentPackage[]>([]);
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [draggingOverColumnId, setDraggingOverColumnId] = useState<KanbanColumnId | null>(null);
  const [updatingPackageId, setUpdatingPackageId] = useState<string | null>(null);
  const groupedPackages = useMemo(() => groupPackages(contentPackages), [contentPackages]);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      const [todayResponse, sessionResponse] = await Promise.all([
        fetch("/api/hq/today"),
        fetch("/api/auth/session"),
      ]);
      if (todayResponse.status === 401 || sessionResponse.status === 401) {
        window.location.assign("/login?from=/");
        return;
      }
      if (!todayResponse.ok || !sessionResponse.ok) {
        throw new Error("HQ_TODAY_KANBAN_FAILED");
      }
      const [todayPayload, sessionPayload] = await Promise.all([
        hqTodayResponseSchema.parse(await todayResponse.json()),
        sessionResponseSchema.parse(await sessionResponse.json()),
      ]);
      if (!active) {
        return;
      }
      setContentPackages(todayPayload.data.content_packages);
      setCsrfToken(sessionPayload.data.csrf_token);
      setStatus("ready");
    }

    load().catch(() => {
      if (active) {
        setStatus("error");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function startDrag(event: DragEvent<HTMLAnchorElement>, contentPackageId: string): void {
    if (updatingPackageId === contentPackageId) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", contentPackageId);
  }

  async function updatePackageStatus(
    contentPackageId: string,
    targetStatus: KanbanPackageStatus,
  ): Promise<void> {
    if (csrfToken === "") {
      setMessage("세션을 불러오는 중입니다.");
      return;
    }
    setUpdatingPackageId(contentPackageId);
    setMessage(isComplianceTarget(targetStatus) ? "검수를 실행하고 상태를 확인하는 중입니다." : "");
    try {
      const response = await fetch(`/api/content-packages/${contentPackageId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          status: targetStatus,
          reason: "HQ kanban drag update",
        }),
      });
      if (!response.ok) {
        const payload = await readApiErrorPayload(response);
        setMessage(kanbanFailureMessage(response.status, payload));
        return;
      }
      const payload = contentPackagePatchResponseSchema.parse(await response.json());
      setContentPackages((current) =>
        current.map((contentPackage) =>
          contentPackage.id === payload.data.id ? payload.data : contentPackage,
        ),
      );
      setMessage(kanbanSuccessMessage(payload.data.status));
    } catch {
      setMessage("상태 업데이트에 실패했습니다.");
    } finally {
      setUpdatingPackageId(null);
    }
  }

  function dragOverColumn(event: DragEvent<HTMLElement>, columnId: KanbanColumnId): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDraggingOverColumnId(columnId);
  }

  function leaveColumn(): void {
    setDraggingOverColumnId(null);
  }

  function dropOnColumn(event: DragEvent<HTMLElement>, targetStatus: KanbanPackageStatus): void {
    event.preventDefault();
    setDraggingOverColumnId(null);
    const contentPackageId = event.dataTransfer.getData("text/plain");
    if (contentPackageId === "" || updatingPackageId === contentPackageId) {
      return;
    }
    void updatePackageStatus(contentPackageId, targetStatus);
  }

  return (
    <section className="section-block" aria-labelledby="pipeline-title">
      <h2 id="pipeline-title">Content Production Pipeline</h2>
      {status === "loading" ? (
        <p className="muted">콘텐츠 파이프라인을 불러오는 중입니다.</p>
      ) : null}
      {status === "error" ? (
        <p className="form-error">콘텐츠 파이프라인을 불러오지 못했습니다.</p>
      ) : null}
      {message === "" ? null : <p className="muted">{message}</p>}
      <section className="kanban-scroll" aria-label="Content package status kanban">
        <div className="kanban-grid">
          {kanbanColumns.map((column) => (
            <section
              aria-label={column.title}
              className={
                draggingOverColumnId === column.id
                  ? "kanban-column kanban-column-active"
                  : "kanban-column"
              }
              key={column.id}
              onDragLeave={leaveColumn}
              onDragOver={(event) => dragOverColumn(event, column.id)}
              onDrop={(event) => dropOnColumn(event, column.targetStatus)}
            >
              <h3>
                {column.title} ({groupedPackages[column.id].length})
              </h3>
              {status === "ready" && groupedPackages[column.id].length === 0 ? (
                <p className="muted">해당 상태의 패키지가 없습니다.</p>
              ) : null}
              {groupedPackages[column.id].map((contentPackage) => {
                const progress = normalizeProgress(contentPackage.progress);
                const updating = updatingPackageId === contentPackage.id;
                return (
                  <a
                    aria-disabled={updating}
                    className="kanban-card"
                    draggable={!updating}
                    href={`/packages/${contentPackage.id}`}
                    key={contentPackage.id}
                    onClick={(event) => {
                      if (updating) {
                        event.preventDefault();
                      }
                    }}
                    onDragStart={(event) => startDrag(event, contentPackage.id)}
                    tabIndex={updating ? -1 : undefined}
                  >
                    <strong>{contentPackage.topic.title}</strong>
                    <span className="badge">{statusLabels[contentPackage.status]}</span>
                    <progress
                      aria-label={`${contentPackage.topic.title} 진행률 ${progress}%`}
                      className="progress-meter"
                      max={100}
                      value={progress}
                    />
                    <span className="muted">
                      진행 {progress}% · {updatedAtLabel(contentPackage.updated_at)}
                    </span>
                    {updating ? (
                      <span className="muted">
                        상태 업데이트 중 · 이 카드 이동 및 열기 비활성화
                      </span>
                    ) : null}
                  </a>
                );
              })}
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}
