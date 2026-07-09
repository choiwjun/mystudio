import {
  affiliateAccountPlatformLabels,
  parseAffiliateAccountPlatform,
  parseAffiliateAccountStatus,
} from "@/components/products/affiliateAccountFields";
import type { AffiliateAccountFormValues } from "@/components/products/types";
import { affiliateAccountPlatforms } from "@/components/products/types";

const snsTargetOptions = ["instagram", "threads", "x", "youtube"] as const;

type AffiliateAccountFormProps = {
  readonly values: AffiliateAccountFormValues;
  readonly message: string;
  readonly onChange: (values: AffiliateAccountFormValues) => void;
  readonly onCreate: () => void;
};

export function AffiliateAccountForm({
  values,
  message,
  onChange,
  onCreate,
}: AffiliateAccountFormProps) {
  function toggleSnsTarget(target: (typeof snsTargetOptions)[number]): void {
    const current = new Set(values.sns_targets);
    if (current.has(target)) {
      current.delete(target);
    } else {
      current.add(target);
    }
    onChange({ ...values, sns_targets: [...current] });
  }

  return (
    <section className="form-panel">
      <h2>어필리에이트 다계정</h2>
      <p className="muted">
        블로그, 쇼핑커넥트, SNS, 쿠팡 등 제휴 계정을 채널별로 나눠 운영 상태를 기록합니다.
      </p>
      <label>
        채널
        <select
          onChange={(event) =>
            onChange({ ...values, platform: parseAffiliateAccountPlatform(event.target.value) })
          }
          value={values.platform}
        >
          {affiliateAccountPlatforms.map((platform) => (
            <option key={platform} value={platform}>
              {affiliateAccountPlatformLabels[platform]}
            </option>
          ))}
        </select>
      </label>
      <label>
        계정명
        <input
          onChange={(event) => onChange({ ...values, account_name: event.target.value })}
          placeholder="예: 네이버 블로그 본계정"
          value={values.account_name}
        />
      </label>
      <label>
        채널 URL
        <input
          onChange={(event) => onChange({ ...values, channel_url: event.target.value })}
          placeholder="https://..."
          value={values.channel_url}
        />
      </label>
      <label>
        제휴 프로그램
        <input
          onChange={(event) => onChange({ ...values, affiliate_program: event.target.value })}
          value={values.affiliate_program}
        />
      </label>
      <label>
        표시/고지 규칙
        <input
          onChange={(event) => onChange({ ...values, disclosure_policy: event.target.value })}
          value={values.disclosure_policy}
        />
      </label>
      <label>
        카테고리 포커스
        <input
          onChange={(event) => onChange({ ...values, category_focus: event.target.value })}
          placeholder="예: 화장품, 스킨케어, 인테리어"
          value={values.category_focus}
        />
      </label>
      <label>
        후킹 스타일
        <input
          onChange={(event) => onChange({ ...values, hook_style: event.target.value })}
          placeholder="예: 큐레이터 추천형, 비교선택형"
          value={values.hook_style}
        />
      </label>
      <fieldset className="form-fieldset">
        <legend>대상 SNS</legend>
        <div className="checkbox-grid">
          {snsTargetOptions.map((target) => (
            <label className="checkbox-row" key={target}>
              <input
                checked={values.sns_targets.includes(target)}
                onChange={() => toggleSnsTarget(target)}
                type="checkbox"
              />
              {target}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        상태
        <select
          onChange={(event) =>
            onChange({ ...values, status: parseAffiliateAccountStatus(event.target.value) })
          }
          value={values.status}
        >
          <option value="setup_needed">신청/연결 필요</option>
          <option value="active">운영중</option>
          <option value="paused">일시중지</option>
        </select>
      </label>
      <label>
        메모
        <textarea
          onChange={(event) => onChange({ ...values, memo: event.target.value })}
          rows={3}
          value={values.memo}
        />
      </label>
      <div className="button-row">
        <button className="button primary" onClick={onCreate} type="button">
          계정 추가
        </button>
        <span className="badge">{message}</span>
      </div>
    </section>
  );
}
