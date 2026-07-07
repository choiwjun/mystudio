import { useState } from "react";
import type {
  DetailComplianceCheck,
  DetailContentPackage,
  DetailDraft,
} from "@/components/content/types";

export type DetailTab = "preview" | "compliance" | "edit";
export type ExportFormatName = "markdown" | "html" | "copy" | "zip";

const detailTabs = ["preview", "compliance", "edit"] as const;
const exportFormats = ["markdown", "html", "copy", "zip"] as const;

type ContentPackageLayoutProps = {
  readonly activeTab: DetailTab;
  readonly canRunPackageActions: boolean;
  readonly check: DetailComplianceCheck | null;
  readonly draft: DetailDraft;
  readonly draftBody: string;
  readonly exportAllowed: boolean;
  readonly keywordText: string;
  readonly packageData: DetailContentPackage;
  readonly status: string;
  readonly onApplyFixes: (checkId: string) => void;
  readonly onDecide: (action: "approve" | "reject") => void;
  readonly onDismissIssue: (issueId: string, dismissReason: string) => void;
  readonly onDraftBodyChange: (body: string) => void;
  readonly onExport: (format: ExportFormatName) => void;
  readonly onRestoreOriginal: () => void;
  readonly onRunCompliance: () => void;
  readonly onGeneratePackage: () => void;
  readonly onGenerateTitleCandidates: () => void;
  readonly onGenerateSearchStructure: () => void;
  readonly onTabChange: (tab: DetailTab) => void;
};

function tabLabel(tab: DetailTab): string {
  if (tab === "preview") {
    return "예상뷰";
  }
  return tab === "compliance" ? "검수" : "편집";
}

const lowRiskDismissReason = "owner accepted low-risk issue";

function exportBlockedMessage(
  check: DetailComplianceCheck | null,
  exportAllowed: boolean,
): string | null {
  if (exportAllowed) {
    return null;
  }
  if (check === null) {
    return "검수 전이라 Export가 대기 중입니다.";
  }
  if (check.risk_level === "high") {
    return "고위험 이슈가 있어 Export가 차단되었습니다. 이슈 해결 후 재검수하세요.";
  }
  if (check.risk_level === "medium") {
    return "중위험 이슈는 담당자 사유를 입력해 무시 처리해야 Export가 가능합니다.";
  }
  return "검수 결과 Export가 대기 중입니다.";
}

function formatDismissalAudit(issue: DetailComplianceCheck["issues"][number]): string {
  const dismissedAt = issue.dismissal?.dismissed_at ?? issue.dismissed_at ?? null;
  const dismissedBy = issue.dismissal?.dismissed_by ?? issue.dismissed_by ?? null;
  const reason = issue.dismissal?.reason ?? issue.dismiss_reason ?? null;
  return [
    dismissedAt === null ? null : `무시 일시 ${dismissedAt}`,
    dismissedBy === null ? null : `담당자 ${dismissedBy}`,
    reason === null ? null : `사유: ${reason}`,
  ]
    .filter((item): item is string => item !== null)
    .join(" · ");
}

export function ContentPackageLayout({
  activeTab,
  canRunPackageActions,
  check,
  draft,
  draftBody,
  exportAllowed,
  keywordText,
  packageData,
  status,
  onApplyFixes,
  onDecide,
  onDismissIssue,
  onDraftBodyChange,
  onExport,
  onRestoreOriginal,
  onRunCompliance,
  onGeneratePackage,
  onGenerateTitleCandidates,
  onGenerateSearchStructure,
  onTabChange,
}: ContentPackageLayoutProps) {
  const selectedTitle =
    packageData.title_candidates.find((candidate) => candidate.selected)?.text ??
    draft.homefeed_title[0] ??
    draft.search_title ??
    packageData.topic.title;
  const [dismissReasons, setDismissReasons] = useState<Record<string, string>>({});
  const [dismissErrors, setDismissErrors] = useState<Record<string, string>>({});
  const blockedExportMessage = exportBlockedMessage(check, exportAllowed);
  const approvalBlockedMessage = exportAllowed
    ? null
    : "검수 통과/Export 가능 상태에서만 승인할 수 있습니다.";

  function dismissLowIssue(issueId: string): void {
    onDismissIssue(issueId, lowRiskDismissReason);
  }

  function dismissMediumIssue(issueId: string): void {
    const reason = dismissReasons[issueId]?.trim() ?? "";
    if (reason === "") {
      setDismissErrors((current) => ({
        ...current,
        [issueId]: "중위험 이슈는 담당자 사유를 입력해야 무시할 수 있습니다.",
      }));
      return;
    }
    setDismissErrors((current) => {
      const next = { ...current };
      delete next[issueId];
      return next;
    });
    onDismissIssue(issueId, reason);
  }
  return (
    <section className="content-detail-grid">
      <aside className="detail-rail" aria-label="콘텐츠 입력 정보">
        <section className="section-block">
          <h2>Opportunity Memo</h2>
          <p>{packageData.opportunity_memo?.why_now ?? packageData.topic.description}</p>
          <span className="badge">{packageData.status}</span>
        </section>
        <section className="section-block">
          <h2>Keyword Clusters</h2>
          <p className="muted">{keywordText}</p>
        </section>
        <section className="section-block">
          <h2>Staged Workflow</h2>
          <div className="button-row compact-actions">
            <button
              className="button primary"
              disabled={!canRunPackageActions}
              onClick={onGeneratePackage}
              type="button"
            >
              패키지 생성
            </button>
            <button
              className="button"
              disabled={!canRunPackageActions}
              onClick={onGenerateTitleCandidates}
              type="button"
            >
              홈피드 제목
            </button>
            <button
              className="button"
              disabled={!canRunPackageActions}
              onClick={onGenerateSearchStructure}
              type="button"
            >
              Search Structure
            </button>
          </div>
          <p className="muted">
            생성은 실제 패키지에서만 실행되며 데모와 불러오기 실패 상태는 차단됩니다.
          </p>
        </section>
        <section className="section-block">
          <h2>Product Candidates</h2>
          {packageData.products.map((product) => (
            <p key={product.id}>
              {product.product_name} ·{" "}
              {product.price === null
                ? "가격 확인 필요"
                : `${product.price.toLocaleString("ko-KR")}원`}
            </p>
          ))}
        </section>
      </aside>

      <main className="detail-main">
        <div className="tabs" role="tablist" aria-label="콘텐츠 상세 탭">
          {detailTabs.map((tab) => (
            <button
              role="tab"
              aria-selected={activeTab === tab}
              className="tab-button"
              key={tab}
              onClick={() => onTabChange(tab)}
              type="button"
            >
              {tabLabel(tab)}
            </button>
          ))}
          <span className="badge">{status}</span>
        </div>

        {activeTab === "preview" ? (
          <article className="section-block preview-pane">
            <h2>{draft.search_title ?? packageData.topic.title}</h2>
            <p className="muted">선택/대표 홈피드 제목: {selectedTitle}</p>
            <section className="memo-row">
              <h3>Title Candidates</h3>
              {packageData.title_candidates.length === 0 && draft.homefeed_title.length === 0 ? (
                <p className="muted">생성된 홈피드 제목 후보가 없습니다.</p>
              ) : (
                <ul>
                  {packageData.title_candidates.map((candidate) => (
                    <li key={candidate.id ?? candidate.text}>
                      {candidate.selected ? "선택됨 · " : ""}
                      {candidate.text}
                    </li>
                  ))}
                  {draft.homefeed_title.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              )}
            </section>
            <section className="memo-row">
              <h3>First Screen / Thumbnail</h3>
              <p>{draft.first_screen ?? "첫 화면 문구 없음"}</p>
              <p className="muted">
                썸네일:{" "}
                {draft.thumbnail_text.length === 0 ? "후보 없음" : draft.thumbnail_text.join(" · ")}
              </p>
            </section>
            <section className="memo-row">
              <h3>Comparison Table</h3>
              {draft.comparison_table === null ? (
                <p className="muted">비교표 없음</p>
              ) : (
                <pre>{draft.comparison_table}</pre>
              )}
            </section>
            <section className="memo-row">
              <h3>FAQ</h3>
              {draft.faq === null || draft.faq.length === 0 ? (
                <p className="muted">FAQ 없음</p>
              ) : (
                <dl>
                  {draft.faq.map((item) => (
                    <div key={item.question}>
                      <dt>{item.question}</dt>
                      <dd>{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
            <section className="memo-row">
              <h3>Disclosure / Price Notice</h3>
              <p>{draft.disclosure_text ?? "쇼핑커넥트 고지 없음"}</p>
              <p>{draft.price_notice ?? "가격 변동 고지 없음"}</p>
            </section>
            <section className="memo-row">
              <h3>Shopping Connect Context</h3>
              {packageData.shopping_connect_links.length === 0 ? (
                <p className="muted">연결된 쇼핑커넥트 링크가 없습니다.</p>
              ) : (
                packageData.shopping_connect_links.map((link) => {
                  const product = packageData.products.find((item) => item.id === link.product_id);
                  return (
                    <p key={link.id}>
                      {product?.product_name ?? link.product_id} · 수수료 {link.commission_rate}% ·{" "}
                      {link.is_active ? "활성" : "비활성"}
                      {link.notes === null ? "" : ` · ${link.notes}`}
                    </p>
                  );
                })
              )}
            </section>
            <section className="memo-row">
              <h3>Export Readiness</h3>
              <p>
                Compliance {check === null ? "미검수" : check.export_allowed ? "통과" : "차단"} ·
                Export {exportAllowed ? "가능" : "대기"} · 생성 기록 {packageData.exports.length}개
              </p>
            </section>
            <pre>{draftBody}</pre>
          </article>
        ) : null}

        {activeTab === "compliance" ? (
          <section className="section-block">
            <h2>Compliance Gate</h2>
            <p>
              {check === null
                ? "검수 전입니다."
                : `Risk ${check.risk_level} · Export ${check.export_allowed ? "allowed" : "blocked"}`}
            </p>
            {check?.issues.map((issue) => {
              const dismissed = issue.dismissed === true || (issue.dismissed_at ?? null) !== null;
              const reasonInputId = `dismiss-reason-${issue.id}`;
              const reasonError = dismissErrors[issue.id] ?? "";
              return (
                <div className="memo-row" key={issue.id}>
                  <p className="muted">
                    {issue.severity}: {issue.message}
                    {dismissed ? " · dismissed" : ""}
                  </p>
                  {issue.suggested_fix === null ? null : <p>{issue.suggested_fix}</p>}
                  {dismissed ? <p className="muted">{formatDismissalAudit(issue)}</p> : null}
                  {!dismissed && issue.severity === "high" ? (
                    <p className="form-error">
                      고위험 이슈는 무시할 수 없습니다. 수정 후 재검수하세요.
                    </p>
                  ) : null}
                  {!dismissed && issue.severity === "low" ? (
                    <button
                      className="button"
                      onClick={() => dismissLowIssue(issue.id)}
                      type="button"
                    >
                      낮은 위험 무시
                    </button>
                  ) : null}
                  {!dismissed && issue.severity === "medium" ? (
                    <>
                      <label htmlFor={reasonInputId}>중위험 무시 사유</label>
                      <textarea
                        aria-describedby={reasonError === "" ? undefined : `${reasonInputId}-error`}
                        id={reasonInputId}
                        onChange={(event) => {
                          setDismissReasons((current) => ({
                            ...current,
                            [issue.id]: event.target.value,
                          }));
                          if (event.target.value.trim() !== "") {
                            setDismissErrors((current) => {
                              const next = { ...current };
                              delete next[issue.id];
                              return next;
                            });
                          }
                        }}
                        value={dismissReasons[issue.id] ?? ""}
                      />
                      {reasonError === "" ? null : (
                        <p className="form-error" id={`${reasonInputId}-error`}>
                          {reasonError}
                        </p>
                      )}
                      <button
                        className="button"
                        onClick={() => dismissMediumIssue(issue.id)}
                        type="button"
                      >
                        사유 입력 후 무시
                      </button>
                    </>
                  ) : null}
                </div>
              );
            })}
            <div className="button-row">
              <button className="button primary" onClick={onRunCompliance} type="button">
                재검수
              </button>
              {check === null || check.issues.length === 0 ? null : (
                <button className="button" onClick={() => onApplyFixes(check.id)} type="button">
                  수정 적용
                </button>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "edit" ? (
          <section className="section-block editor-pane">
            <h2>Markdown Editor</h2>
            <textarea
              aria-label="body_markdown"
              onChange={(event) => onDraftBodyChange(event.target.value)}
              value={draftBody}
            />
            <div className="button-row compact-actions">
              <button className="button" onClick={onRestoreOriginal} type="button">
                원문 복원
              </button>
            </div>
            <p className="muted">본문 정본은 Markdown이며 2초 후 자동 저장됩니다.</p>
          </section>
        ) : null}
      </main>

      <aside className="detail-rail" aria-label="승인 및 Export">
        <section className="section-block">
          <h2>Export</h2>
          {blockedExportMessage === null ? null : (
            <p className="form-error">{blockedExportMessage}</p>
          )}
          <div className="button-row">
            {exportFormats.map((format) => (
              <button
                className="button"
                disabled={!exportAllowed}
                key={format}
                onClick={() => onExport(format)}
                type="button"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </section>
        <section className="section-block">
          <h2>Owner Approval</h2>
          {approvalBlockedMessage === null ? null : (
            <p className="form-error">{approvalBlockedMessage}</p>
          )}
          <div className="button-row">
            <button
              className="button primary"
              disabled={!exportAllowed}
              onClick={() => onDecide("approve")}
              type="button"
            >
              승인
            </button>
            <button className="button" onClick={() => onDecide("reject")} type="button">
              반려
            </button>
          </div>
        </section>
      </aside>
    </section>
  );
}
