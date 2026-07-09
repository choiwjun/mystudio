"use client";

import { useCallback, useEffect, useState } from "react";
import {
  affiliateAccountPlatformLabels,
  parseAffiliateAccountPlatform,
} from "@/components/products/affiliateAccountFields";
import {
  affiliateAccountListResponseSchema,
  affiliateLinkListResponseSchema,
  affiliateLinkMutationResponseSchema,
  contentPackageListResponseSchema,
  productDeleteResponseSchema,
  productListResponseSchema,
  sessionResponseSchema,
} from "@/components/products/productSchemas";
import type {
  AffiliateAccount,
  AffiliateLink,
  AffiliateLinkFormValues,
  ContentPackageSummary,
  Product,
} from "@/components/products/types";

const emptyAffiliateLinkForm: AffiliateLinkFormValues = {
  account_id: "",
  product_id: "",
  content_package_id: "",
  platform: "coupang",
  program: "쿠팡 파트너스",
  destination_url: "",
  affiliate_url: "",
  commission_rate: "",
  disclosure_policy: "대가성 문구를 본문 상단과 링크 근처에 표시",
  placement_guide: "",
  notes: "",
};

function affiliateLinkToForm(link: AffiliateLink): AffiliateLinkFormValues {
  return {
    account_id: link.account_id ?? "",
    product_id: link.product_id ?? "",
    content_package_id: link.content_package_id ?? "",
    platform: link.platform,
    program: link.program,
    destination_url: link.destination_url,
    affiliate_url: link.affiliate_url,
    commission_rate: link.commission_rate.toString(),
    disclosure_policy: link.disclosure_policy,
    placement_guide: link.placement_guide ?? "",
    notes: link.notes ?? "",
  };
}

function linkPayload(form: AffiliateLinkFormValues) {
  const commissionRate = Number(form.commission_rate);
  return {
    ...(form.account_id.trim() === "" ? {} : { account_id: form.account_id }),
    ...(form.product_id.trim() === "" ? {} : { product_id: form.product_id }),
    ...(form.content_package_id.trim() === ""
      ? {}
      : { content_package_id: form.content_package_id }),
    platform: form.platform,
    program: form.program,
    destination_url: form.destination_url,
    affiliate_url: form.affiliate_url,
    commission_rate: commissionRate,
    disclosure_policy: form.disclosure_policy,
    ...(form.placement_guide.trim() === "" ? {} : { placement_guide: form.placement_guide }),
    ...(form.notes.trim() === "" ? {} : { notes: form.notes }),
  };
}

function isValidLinkForm(form: AffiliateLinkFormValues): boolean {
  const commissionRate = Number(form.commission_rate);
  return (
    form.program.trim() !== "" &&
    form.destination_url.trim() !== "" &&
    form.affiliate_url.trim() !== "" &&
    form.disclosure_policy.trim() !== "" &&
    Number.isFinite(commissionRate) &&
    commissionRate >= 0
  );
}

type LinkFormProps = {
  readonly accounts: readonly AffiliateAccount[];
  readonly contentPackages: readonly ContentPackageSummary[];
  readonly form: AffiliateLinkFormValues;
  readonly products: readonly Product[];
  readonly onChange: (form: AffiliateLinkFormValues) => void;
};

function AffiliateLinkForm({ accounts, contentPackages, form, products, onChange }: LinkFormProps) {
  return (
    <div className="form-grid">
      <label>
        계정
        <select
          onChange={(event) => onChange({ ...form, account_id: event.target.value })}
          value={form.account_id}
        >
          <option value="">계정 미지정</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {affiliateAccountPlatformLabels[account.platform]} · {account.account_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        플랫폼
        <select
          onChange={(event) =>
            onChange({
              ...form,
              platform: parseAffiliateAccountPlatform(event.target.value),
            })
          }
          value={form.platform}
        >
          {Object.entries(affiliateAccountPlatformLabels).map(([platform, label]) => (
            <option key={platform} value={platform}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        프로그램
        <input
          onChange={(event) => onChange({ ...form, program: event.target.value })}
          value={form.program}
        />
      </label>
      <label>
        상품
        <select
          onChange={(event) => onChange({ ...form, product_id: event.target.value })}
          value={form.product_id}
        >
          <option value="">상품 미지정</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.product_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        콘텐츠 패키지
        <select
          onChange={(event) => onChange({ ...form, content_package_id: event.target.value })}
          value={form.content_package_id}
        >
          <option value="">패키지 미지정</option>
          {contentPackages.map((contentPackage) => (
            <option key={contentPackage.id} value={contentPackage.id}>
              {contentPackage.topic.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        원본 URL
        <input
          onChange={(event) => onChange({ ...form, destination_url: event.target.value })}
          value={form.destination_url}
        />
      </label>
      <label>
        제휴 URL
        <input
          onChange={(event) => onChange({ ...form, affiliate_url: event.target.value })}
          value={form.affiliate_url}
        />
      </label>
      <label>
        수수료율(%)
        <input
          onChange={(event) => onChange({ ...form, commission_rate: event.target.value })}
          step="0.1"
          type="number"
          value={form.commission_rate}
        />
      </label>
      <label>
        고지 정책
        <input
          onChange={(event) => onChange({ ...form, disclosure_policy: event.target.value })}
          value={form.disclosure_policy}
        />
      </label>
      <label>
        배치 메모
        <input
          onChange={(event) => onChange({ ...form, placement_guide: event.target.value })}
          value={form.placement_guide}
        />
      </label>
      <label>
        운영 메모
        <input
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
          value={form.notes}
        />
      </label>
    </div>
  );
}

export function AffiliateLinksPanel() {
  const [accounts, setAccounts] = useState<readonly AffiliateAccount[]>([]);
  const [contentPackages, setContentPackages] = useState<readonly ContentPackageSummary[]>([]);
  const [links, setLinks] = useState<readonly AffiliateLink[]>([]);
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [csrfToken, setCsrfToken] = useState("");
  const [form, setForm] = useState<AffiliateLinkFormValues>(emptyAffiliateLinkForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AffiliateLinkFormValues>(emptyAffiliateLinkForm);
  const [message, setMessage] = useState("제휴 링크를 불러오는 중입니다");

  const loadLinks = useCallback(async (): Promise<void> => {
    const [sessionResponse, accountsResponse, linksResponse, productsResponse, packagesResponse] =
      await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/affiliate-accounts"),
        fetch("/api/affiliate-links"),
        fetch("/api/products"),
        fetch("/api/content-packages"),
      ]);
    if (
      sessionResponse.status === 401 ||
      accountsResponse.status === 401 ||
      linksResponse.status === 401 ||
      productsResponse.status === 401 ||
      packagesResponse.status === 401
    ) {
      setMessage("세션 확인 실패");
      return;
    }
    if (
      !sessionResponse.ok ||
      !accountsResponse.ok ||
      !linksResponse.ok ||
      !productsResponse.ok ||
      !packagesResponse.ok
    ) {
      setMessage("제휴 링크 불러오기 실패");
      return;
    }

    setCsrfToken(sessionResponseSchema.parse(await sessionResponse.json()).data.csrf_token);
    setAccounts(
      affiliateAccountListResponseSchema.parse(await accountsResponse.json()).data
        .affiliate_accounts,
    );
    setLinks(
      affiliateLinkListResponseSchema.parse(await linksResponse.json()).data.affiliate_links,
    );
    setProducts(productListResponseSchema.parse(await productsResponse.json()).data.products);
    setContentPackages(
      contentPackageListResponseSchema.parse(await packagesResponse.json()).data.content_packages,
    );
    setMessage("저장됨");
  }, []);

  useEffect(() => {
    void loadLinks().catch(() => setMessage("제휴 링크 불러오기 실패"));
  }, [loadLinks]);

  function applyLink(link: AffiliateLink): void {
    setLinks((current) =>
      current.some((item) => item.id === link.id)
        ? current.map((item) => (item.id === link.id ? link : item))
        : [link, ...current],
    );
  }

  async function createLink(): Promise<void> {
    if (!isValidLinkForm(form)) {
      setMessage("프로그램, URL, 고지 정책, 수수료율을 확인하세요");
      return;
    }
    const response = await fetch("/api/affiliate-links", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(linkPayload(form)),
    });
    if (!response.ok) {
      setMessage("제휴 링크 저장 실패");
      return;
    }
    const payload = affiliateLinkMutationResponseSchema.parse(await response.json());
    applyLink(payload.data);
    setForm(emptyAffiliateLinkForm);
    setMessage("제휴 링크가 저장되었습니다");
  }

  async function saveEdit(): Promise<void> {
    if (editingId === null) {
      return;
    }
    if (!isValidLinkForm(editForm)) {
      setMessage("수정할 링크의 필수값을 확인하세요");
      return;
    }
    const response = await fetch(`/api/affiliate-links/${editingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({
        ...linkPayload(editForm),
        account_id: editForm.account_id.trim() === "" ? null : editForm.account_id,
        product_id: editForm.product_id.trim() === "" ? null : editForm.product_id,
        content_package_id:
          editForm.content_package_id.trim() === "" ? null : editForm.content_package_id,
      }),
    });
    if (!response.ok) {
      setMessage("제휴 링크 수정 실패");
      return;
    }
    const payload = affiliateLinkMutationResponseSchema.parse(await response.json());
    applyLink(payload.data);
    setEditingId(null);
    setEditForm(emptyAffiliateLinkForm);
    setMessage("제휴 링크가 수정되었습니다");
  }

  async function toggleLink(link: AffiliateLink): Promise<void> {
    const response = await fetch(`/api/affiliate-links/${link.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ is_active: !link.is_active }),
    });
    if (!response.ok) {
      setMessage("링크 상태 변경 실패");
      return;
    }
    applyLink(affiliateLinkMutationResponseSchema.parse(await response.json()).data);
    setMessage("링크 상태가 변경되었습니다");
  }

  async function deleteLink(link: AffiliateLink): Promise<void> {
    if (!window.confirm(`${link.program} 링크를 삭제할까요?`)) {
      return;
    }
    const response = await fetch(`/api/affiliate-links/${link.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken },
    });
    if (!response.ok) {
      setMessage("링크 삭제 실패");
      return;
    }
    productDeleteResponseSchema.parse(await response.json());
    setLinks(links.filter((item) => item.id !== link.id));
    setMessage("링크가 삭제되었습니다");
  }

  return (
    <div className="affiliate-account-grid" id="affiliate-links">
      <section className="form-panel">
        <div className="section-heading-row">
          <h2>범용 제휴 링크</h2>
          <span className="badge">{message}</span>
        </div>
        <p className="muted">
          쿠팡, 무신사, 올리브영 등 일반 제휴 URL을 상품과 콘텐츠 패키지에 연결합니다.
        </p>
        <AffiliateLinkForm
          accounts={accounts}
          contentPackages={contentPackages}
          form={form}
          onChange={setForm}
          products={products}
        />
        <div className="button-row">
          <button className="button primary" onClick={() => void createLink()} type="button">
            제휴 링크 저장
          </button>
        </div>
      </section>
      <section className="table-panel">
        <h2>범용 제휴 링크</h2>
        {editingId === null ? null : (
          <section className="form-panel">
            <h2>제휴 링크 수정</h2>
            <AffiliateLinkForm
              accounts={accounts}
              contentPackages={contentPackages}
              form={editForm}
              onChange={setEditForm}
              products={products}
            />
            <div className="button-row">
              <button className="button primary" onClick={() => void saveEdit()} type="button">
                수정 저장
              </button>
              <button
                className="button"
                onClick={() => {
                  setEditingId(null);
                  setEditForm(emptyAffiliateLinkForm);
                }}
                type="button"
              >
                취소
              </button>
            </div>
          </section>
        )}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>플랫폼</th>
                <th>프로그램</th>
                <th>수수료율</th>
                <th>고지 정책</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {links.length === 0 ? (
                <tr>
                  <td colSpan={6}>등록된 범용 제휴 링크가 없습니다.</td>
                </tr>
              ) : (
                links.map((link) => (
                  <tr key={link.id}>
                    <td>{affiliateAccountPlatformLabels[link.platform]}</td>
                    <td>{link.program}</td>
                    <td>{link.commission_rate}%</td>
                    <td>{link.disclosure_policy}</td>
                    <td>{link.is_active ? "활성" : "비활성"}</td>
                    <td>
                      <div className="button-row compact-actions">
                        <button
                          className="button"
                          onClick={() => {
                            setEditingId(link.id);
                            setEditForm(affiliateLinkToForm(link));
                          }}
                          type="button"
                        >
                          수정
                        </button>
                        <button
                          className="button"
                          onClick={() => void toggleLink(link)}
                          type="button"
                        >
                          상태 변경
                        </button>
                        <button
                          className="button"
                          onClick={() => void deleteLink(link)}
                          type="button"
                        >
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
    </div>
  );
}
