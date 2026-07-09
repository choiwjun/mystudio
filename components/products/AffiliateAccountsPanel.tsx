"use client";

import { useEffect, useState } from "react";
import { AffiliateAccountForm } from "@/components/products/AffiliateAccountForm";
import { AffiliateAccountTable } from "@/components/products/AffiliateAccountTable";
import { emptyAffiliateAccountForm } from "@/components/products/affiliateAccountFields";
import {
  affiliateAccountContentPlanResponseSchema,
  affiliateAccountListResponseSchema,
  affiliateAccountMutationResponseSchema,
  productDeleteResponseSchema,
  sessionResponseSchema,
} from "@/components/products/productSchemas";
import type {
  AffiliateAccount,
  AffiliateAccountFormValues,
  AffiliateAccountStatus,
} from "@/components/products/types";

const emptyAccounts: readonly AffiliateAccount[] = [];

function nextStatus(status: AffiliateAccountStatus): AffiliateAccountStatus {
  switch (status) {
    case "setup_needed":
      return "active";
    case "active":
      return "paused";
    case "paused":
      return "active";
  }
}

function splitCommaValues(value: string): readonly string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function AffiliateAccountsPanel() {
  const [accounts, setAccounts] = useState<readonly AffiliateAccount[]>(emptyAccounts);
  const [formValues, setFormValues] =
    useState<AffiliateAccountFormValues>(emptyAffiliateAccountForm);
  const [csrfToken, setCsrfToken] = useState("");
  const [message, setMessage] = useState("계정 운영안을 불러오는 중입니다");

  useEffect(() => {
    async function loadAccounts(): Promise<void> {
      const [sessionResponse, accountsResponse] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/affiliate-accounts"),
      ]);
      if (sessionResponse.status === 401 || accountsResponse.status === 401) {
        setMessage("세션 확인 실패");
        return;
      }
      if (!sessionResponse.ok || !accountsResponse.ok) {
        setMessage("제휴 계정 불러오기 실패");
        return;
      }
      const sessionPayload = sessionResponseSchema.parse(await sessionResponse.json());
      const accountsPayload = affiliateAccountListResponseSchema.parse(
        await accountsResponse.json(),
      );
      setCsrfToken(sessionPayload.data.csrf_token);
      setAccounts(accountsPayload.data.affiliate_accounts);
      setMessage("제휴 계정이 서버에 저장됩니다");
    }

    void loadAccounts().catch(() => setMessage("제휴 계정 불러오기 실패"));
  }, []);

  async function createAccount(): Promise<void> {
    const accountName = formValues.account_name.trim();
    const affiliateProgram = formValues.affiliate_program.trim();
    if (accountName === "" || affiliateProgram === "") {
      setMessage("계정명과 제휴 프로그램은 필수입니다");
      return;
    }

    const response = await fetch("/api/affiliate-accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        platform: formValues.platform,
        account_name: accountName,
        channel_url: formValues.channel_url.trim(),
        affiliate_program: affiliateProgram,
        disclosure_policy: formValues.disclosure_policy.trim(),
        category_focus: splitCommaValues(formValues.category_focus),
        sns_targets: formValues.sns_targets,
        hook_style: formValues.hook_style.trim(),
        status: formValues.status,
        memo: formValues.memo.trim(),
      }),
    });

    if (!response.ok) {
      setMessage("제휴 계정 추가 실패");
      return;
    }

    const payload = affiliateAccountMutationResponseSchema.parse(await response.json());
    setAccounts([payload.data, ...accounts]);
    setFormValues(emptyAffiliateAccountForm);
    setMessage("제휴 계정이 추가되었습니다");
  }

  async function toggleAccountStatus(account: AffiliateAccount): Promise<void> {
    const response = await fetch(`/api/affiliate-accounts/${account.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ status: nextStatus(account.status) }),
    });
    if (!response.ok) {
      setMessage("계정 상태 변경 실패");
      return;
    }
    const payload = affiliateAccountMutationResponseSchema.parse(await response.json());
    setAccounts(accounts.map((item) => (item.id === payload.data.id ? payload.data : item)));
    setMessage("계정 상태가 변경되었습니다");
  }

  async function buildContentPlan(account: AffiliateAccount): Promise<void> {
    const response = await fetch(`/api/affiliate-accounts/${account.id}/content-plan`, {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
    });
    if (!response.ok) {
      setMessage("계정 운영안 생성 실패");
      return;
    }
    const payload = affiliateAccountContentPlanResponseSchema.parse(await response.json());
    const plan = payload.data.content_plan;
    const productName = plan.selected_product?.product_name ?? "연결 상품 없음";
    setMessage(`${plan.account_name} · ${productName} · ${plan.hook_ment}`);
  }

  async function removeAccount(accountId: string): Promise<void> {
    const response = await fetch(`/api/affiliate-accounts/${accountId}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken },
    });
    if (!response.ok) {
      setMessage("제휴 계정 삭제 실패");
      return;
    }
    productDeleteResponseSchema.parse(await response.json());
    setAccounts(accounts.filter((account) => account.id !== accountId));
    setMessage("제휴 계정이 제거되었습니다");
  }

  return (
    <div className="affiliate-account-grid" id="accounts">
      <AffiliateAccountForm
        message={message}
        onChange={setFormValues}
        onCreate={() => void createAccount()}
        values={formValues}
      />
      <AffiliateAccountTable
        accounts={accounts}
        onBuildContentPlan={(account) => void buildContentPlan(account)}
        onRemove={(accountId) => void removeAccount(accountId)}
        onToggleStatus={(account) => void toggleAccountStatus(account)}
      />
    </div>
  );
}
