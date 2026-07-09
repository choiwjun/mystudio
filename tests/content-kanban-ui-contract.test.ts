import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contentDetailSource = readFileSync("components/content/ContentPackageDetail.tsx", "utf8");
const contentLayoutSource = readFileSync("components/content/ContentPackageLayout.tsx", "utf8");
const contentSerializerSource = readFileSync("lib/content/serializers.ts", "utf8");
const kanbanSource = readFileSync("components/hq/HqKanbanBoard.tsx", "utf8");

describe("content compliance dismissal UI contract", () => {
  it("requires an owner-entered reason before dismissing medium severity issues", () => {
    expect(contentLayoutSource).toContain("중위험 무시 사유");
    expect(contentLayoutSource).toContain(
      "중위험 이슈는 담당자 사유를 입력해야 무시할 수 있습니다.",
    );
    expect(contentLayoutSource).toContain("function dismissMediumIssue(issueId: string): void");
    expect(contentLayoutSource).toContain('if (reason === "")');
    expect(contentLayoutSource).toContain("onDismissIssue(issueId, reason)");
  });

  it("keeps high severity issues non-dismissible and low severity one-click with a default reason", () => {
    expect(contentLayoutSource).toContain(
      "고위험 이슈는 무시할 수 없습니다. 수정 후 재검수하세요.",
    );
    expect(contentLayoutSource).toContain('issue.severity === "high"');
    expect(contentLayoutSource).toContain(
      'const lowRiskDismissReason = "owner accepted low-risk issue"',
    );
    expect(contentLayoutSource).toContain("function dismissLowIssue(issueId: string): void");
    expect(contentLayoutSource).toContain("onDismissIssue(issueId, lowRiskDismissReason)");
  });

  it("posts the UI-provided dismiss reason and displays dismissal audit metadata", () => {
    expect(contentDetailSource).not.toContain("owner accepted medium or low risk");
    expect(contentDetailSource).toContain("dismiss_reason: dismissReason");
    expect(contentLayoutSource).toContain("function formatDismissalAudit");
    expect(contentLayoutSource).toContain("무시 일시");
    expect(contentLayoutSource).toContain("담당자");
    expect(contentLayoutSource).toContain("사유:");
  });

  it("serializes dismissal metadata so audit copy survives package reload", () => {
    expect(contentSerializerSource).toContain("function serializeContentComplianceIssue");
    expect(contentSerializerSource).toContain("dismiss_reason: dismissal?.reason ?? null");
    expect(contentSerializerSource).toContain("dismissed_by: dismissal?.dismissed_by ?? null");
    expect(contentSerializerSource).toContain("blocks_export:");
  });

  it("blocks owner approval until compliance/export readiness is true", () => {
    expect(contentLayoutSource).toContain(
      "검수 통과 후 담당자 승인 대기 상태에서만 승인할 수 있습니다.",
    );
    expect(contentLayoutSource).toContain("disabled={!ownerApprovalAllowed}");
    expect(contentLayoutSource).toContain("disabled={!exportAllowed}");
  });

  it("distinguishes high-risk export blocking from medium pending-reason blocking", () => {
    expect(contentLayoutSource).toContain(
      "고위험 이슈가 있어 내보내기가 차단되었습니다. 이슈 해결 후 재검수하세요.",
    );
    expect(contentLayoutSource).toContain(
      "중위험 이슈는 담당자 사유를 입력해 무시 처리해야 내보내기가 가능합니다.",
    );
    expect(contentLayoutSource).toContain("blockedExportMessage");
  });
});

describe("HQ kanban side-effect UX contract", () => {
  it("shows compliance-running, returned-status, failure, and affected-card disabled copy", () => {
    expect(kanbanSource).toContain("검수를 실행하고 상태를 확인하는 중입니다.");
    expect(kanbanSource).toContain("kanbanSuccessMessage(payload.data.status)");
    expect(kanbanSource).toContain("검수를 실행하려면 먼저 초안이 필요합니다.");
    expect(kanbanSource).toContain("허용되지 않는 상태 전환입니다.");
    expect(kanbanSource).toContain("aria-disabled={updating}");
    expect(kanbanSource).toContain("상태 업데이트 중 · 이 카드 이동 및 열기 비활성화");
  });
});
