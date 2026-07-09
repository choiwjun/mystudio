import {
  affiliateAccountPlatformLabels,
  affiliateAccountStatusLabels,
} from "@/components/products/affiliateAccountFields";
import type { AffiliateAccount } from "@/components/products/types";

type AffiliateAccountTableProps = {
  readonly accounts: readonly AffiliateAccount[];
  readonly onBuildContentPlan: (account: AffiliateAccount) => void;
  readonly onRemove: (accountId: string) => void;
  readonly onToggleStatus: (account: AffiliateAccount) => void;
};

export function AffiliateAccountTable({
  accounts,
  onBuildContentPlan,
  onRemove,
  onToggleStatus,
}: AffiliateAccountTableProps) {
  return (
    <section className="table-panel">
      <h2>계정 목록</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>채널</th>
              <th>계정</th>
              <th>제휴 프로그램</th>
              <th>운영 포커스</th>
              <th>고지 규칙</th>
              <th>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={7}>등록된 제휴 계정이 없습니다.</td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id}>
                  <td>{affiliateAccountPlatformLabels[account.platform]}</td>
                  <td>
                    <strong>{account.account_name}</strong>
                    <br />
                    <span className="muted">{account.channel_url || "채널 URL 미등록"}</span>
                  </td>
                  <td>{account.affiliate_program}</td>
                  <td>
                    {account.category_focus.length === 0
                      ? "카테고리 미지정"
                      : account.category_focus.join(", ")}
                    <br />
                    <span className="muted">
                      {account.sns_targets.length === 0
                        ? "SNS 타깃 미지정"
                        : account.sns_targets.join(", ")}
                      {account.hook_style === "" ? "" : ` · ${account.hook_style}`}
                    </span>
                  </td>
                  <td>{account.disclosure_policy || "고지 규칙 미정"}</td>
                  <td>{affiliateAccountStatusLabels[account.status]}</td>
                  <td>
                    <div className="button-row compact-actions">
                      <button
                        className="button"
                        onClick={() => onBuildContentPlan(account)}
                        type="button"
                      >
                        운영안
                      </button>
                      <button
                        className="button"
                        onClick={() => onToggleStatus(account)}
                        type="button"
                      >
                        상태 변경
                      </button>
                      <button className="button" onClick={() => onRemove(account.id)} type="button">
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
