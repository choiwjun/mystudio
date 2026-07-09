import { useState } from "react";
import type {
  DetailComplianceCheck,
  DetailContentPackage,
  DetailDraft,
} from "@/components/content/types";

export type DetailTab = "preview" | "clip" | "sns" | "compliance" | "edit";
export type ExportFormatName = "markdown" | "html" | "copy" | "zip";

const detailTabs = ["preview", "clip", "sns", "compliance", "edit"] as const;
const exportFormats = ["markdown", "html", "copy", "zip"] as const;

type ContentPackageLayoutProps = {
  readonly activeTab: DetailTab;
  readonly canRunPackageActions: boolean;
  readonly check: DetailComplianceCheck | null;
  readonly draft: DetailDraft;
  readonly draftBody: string;
  readonly exportAllowed: boolean;
  readonly ownerApprovalAllowed: boolean;
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
  readonly onGenerateSnsVariants: () => void;
  readonly onTabChange: (tab: DetailTab) => void;
};

function tabLabel(tab: DetailTab): string {
  switch (tab) {
    case "preview":
      return "예상뷰";
    case "clip":
      return "클립 대본";
    case "sns":
      return "SNS 변환";
    case "compliance":
      return "검수";
    case "edit":
      return "편집";
  }
}

const lowRiskDismissReason = "owner accepted low-risk issue";

function exportBlockedMessage(
  packageData: DetailContentPackage,
  check: DetailComplianceCheck | null,
  exportAllowed: boolean,
): string | null {
  if (exportAllowed) {
    return null;
  }
  if (check === null) {
    return "검수 전이라 내보내기가 대기 중입니다.";
  }
  if (check.export_allowed === true && packageData.status === "owner_approval_required") {
    return "담당자 승인 전이라 내보내기가 대기 중입니다. 승인 후 내보낼 수 있습니다.";
  }
  if (check.export_allowed === true) {
    return "서버 내보내기 가능 상태가 아닙니다. 패키지 상태가 승인/내보내기 완료가 되어야 합니다.";
  }
  if (check.risk_level === "high") {
    return "고위험 이슈가 있어 내보내기가 차단되었습니다. 이슈 해결 후 재검수하세요.";
  }
  if (check.risk_level === "medium") {
    return "중위험 이슈는 담당자 사유를 입력해 무시 처리해야 내보내기가 가능합니다.";
  }
  return "검수 결과 내보내기가 대기 중입니다.";
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

function workflowResumeMessage(packageData: DetailContentPackage, draft: DetailDraft): string {
  const hasDraft = draft.id !== "empty_draft" && (draft.body_markdown?.trim().length ?? 0) > 0;
  const hasHomefeedTitles =
    packageData.title_candidates.some((candidate) => candidate.kind === "homefeed") ||
    draft.homefeed_title.length > 0;
  const hasThumbnails = draft.thumbnail_text.length > 0;
  const hasSearchStructure =
    draft.search_title !== null || draft.comparison_table !== null || (draft.faq?.length ?? 0) > 0;
  if (!hasDraft) {
    return "다음 단계: 패키지 생성으로 초안 산출물을 만드세요.";
  }
  if (!hasHomefeedTitles || !hasThumbnails) {
    return "재개 지점: 초안 있음 · 홈피드 제목/썸네일 후보를 보강하세요.";
  }
  if (!hasSearchStructure) {
    return "재개 지점: 초안 있음 · 검색 구조 생성으로 검색 산출물을 보강하세요.";
  }
  if (packageData.compliance_checks.length === 0) {
    return "재개 지점: 산출물 있음 · 검수를 실행하세요.";
  }
  if (packageData.status === "owner_approval_required") {
    return "재개 지점: 검수 통과 · 담당자 승인 후 내보내기 가능합니다.";
  }
  if (packageData.status === "approved") {
    return "재개 지점: 승인됨 · 내보내기 생성 단계입니다.";
  }
  return `현재 단계: ${packageData.status} · 기존 산출물을 이어서 사용합니다.`;
}

export function ContentPackageLayout({
  activeTab,
  canRunPackageActions,
  check,
  draft,
  draftBody,
  exportAllowed,
  ownerApprovalAllowed,
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
  onGenerateSnsVariants,
  onTabChange,
}: ContentPackageLayoutProps) {
  const selectedTitle =
    packageData.title_candidates.find((candidate) => candidate.selected)?.text ??
    draft.homefeed_title[0] ??
    draft.search_title ??
    packageData.topic.title;
  const [dismissReasons, setDismissReasons] = useState<Record<string, string>>({});
  const [dismissErrors, setDismissErrors] = useState<Record<string, string>>({});
  const blockedExportMessage = exportBlockedMessage(packageData, check, exportAllowed);
  const approvalBlockedMessage = ownerApprovalAllowed
    ? null
    : "검수 통과 후 담당자 승인 대기 상태에서만 승인할 수 있습니다.";
  const resumeMessage = workflowResumeMessage(packageData, draft);

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
          <h2>기회 메모</h2>
          <p>{packageData.opportunity_memo?.why_now ?? packageData.topic.description}</p>
          <span className="badge">{packageData.status}</span>
        </section>
        <section className="section-block">
          <h2>키워드 묶음</h2>
          <p className="muted">{keywordText}</p>
        </section>
        <section className="section-block">
          <h2>제작 단계</h2>
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
              검색 구조
            </button>
            <button
              className="button"
              disabled={!canRunPackageActions}
              onClick={onGenerateSnsVariants}
              type="button"
            >
              클립/SNS
            </button>
          </div>
          <p className="muted">
            생성은 실제 패키지에서만 실행되며 데모와 불러오기 실패 상태는 차단됩니다.
          </p>
          <p className="muted">{resumeMessage}</p>
        </section>
        <section className="section-block">
          <h2>상품 후보</h2>
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
              <h3>제목 후보</h3>
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
              <h3>첫 화면 / 썸네일</h3>
              <p>{draft.first_screen ?? "첫 화면 문구 없음"}</p>
              <p className="muted">
                썸네일:{" "}
                {draft.thumbnail_text.length === 0 ? "후보 없음" : draft.thumbnail_text.join(" · ")}
              </p>
            </section>
            <section className="memo-row">
              <h3>비교표</h3>
              {draft.comparison_table === null ? (
                <p className="muted">비교표 없음</p>
              ) : (
                <pre>{draft.comparison_table}</pre>
              )}
            </section>
            <section className="memo-row">
              <h3>질문 답변</h3>
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
              <h3>고지 / 가격 안내</h3>
              <p>{draft.disclosure_text ?? "쇼핑커넥트 고지 없음"}</p>
              <p>{draft.price_notice ?? "가격 변동 고지 없음"}</p>
            </section>
            <section className="memo-row">
              <h3>제휴 링크 맥락</h3>
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
              <h3>내보내기 준비 상태</h3>
              <p>
                검수 {check === null ? "미검수" : check.export_allowed ? "통과" : "차단"} · 내보내기{" "}
                {exportAllowed ? "가능" : "대기"} · 상태 {packageData.status} · 생성 기록{" "}
                {packageData.exports.length}개
              </p>
            </section>
            <pre>{draftBody}</pre>
          </article>
        ) : null}

        {activeTab === "clip" ? (
          <section className="section-block">
            <h2>네이버 클립 대본</h2>
            {packageData.sns_variants.filter((variant) => variant.platform === "naver_clip")
              .length === 0 ? (
              <p className="muted">클립 대본이 없습니다. 왼쪽의 클립/SNS 버튼으로 생성하세요.</p>
            ) : (
              packageData.sns_variants
                .filter((variant) => variant.platform === "naver_clip")
                .map((variant) => (
                  <article className="memo-row" key={variant.id}>
                    <h3>{variant.hook ?? "클립 대본"}</h3>
                    <pre>{variant.body}</pre>
                    <p className="muted">{variant.cta ?? "블로그 재방문 CTA 없음"}</p>
                    <p className="muted">{variant.hashtags.join(" ")}</p>
                  </article>
                ))
            )}
          </section>
        ) : null}

        {activeTab === "sns" ? (
          <section className="section-block">
            <h2>SNS 변환본</h2>
            {packageData.sns_variants.filter((variant) => variant.platform !== "naver_clip")
              .length === 0 ? (
              <p className="muted">SNS 변환본이 없습니다. 왼쪽의 클립/SNS 버튼으로 생성하세요.</p>
            ) : (
              packageData.sns_variants
                .filter((variant) => variant.platform !== "naver_clip")
                .map((variant) => (
                  <article className="memo-row" key={variant.id}>
                    <h3>
                      {variant.platform} · {variant.format}
                    </h3>
                    {variant.hook === null ? null : <p>{variant.hook}</p>}
                    <pre>{variant.body}</pre>
                    {variant.cta === null ? null : <p className="muted">{variant.cta}</p>}
                    <p className="muted">{variant.hashtags.join(" ")}</p>
                  </article>
                ))
            )}
          </section>
        ) : null}

        {activeTab === "compliance" ? (
          <section className="section-block">
            <h2>검수 게이트</h2>
            <p>
              {check === null
                ? "검수 전입니다."
                : `위험도 ${check.risk_level} · 내보내기 ${check.export_allowed ? "허용" : "차단"}`}
            </p>
            {check?.issues.map((issue) => {
              const dismissed = issue.dismissed === true || (issue.dismissed_at ?? null) !== null;
              const reasonInputId = `dismiss-reason-${issue.id}`;
              const reasonError = dismissErrors[issue.id] ?? "";
              return (
                <div className="memo-row" key={issue.id}>
                  <p className="muted">
                    {issue.severity}: {issue.message}
                    {dismissed ? " · 무시 처리됨" : ""}
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
            <h2>마크다운 편집기</h2>
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

      <aside className="detail-rail" aria-label="승인 및 내보내기">
        <section className="section-block">
          <h2>내보내기</h2>
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
          <h2>오너 승인</h2>
          {approvalBlockedMessage === null ? null : (
            <p className="form-error">{approvalBlockedMessage}</p>
          )}
          <div className="button-row">
            <button
              className="button primary"
              disabled={!ownerApprovalAllowed}
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
