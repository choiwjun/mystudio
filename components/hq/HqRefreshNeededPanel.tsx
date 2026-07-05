"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

type RefreshNeededProduct = {
  readonly id: string;
  readonly product_name: string;
  readonly price_checked_at: string | null;
};

type RefreshNeededLink = {
  readonly id: string;
  readonly shopping_connect_url: string;
  readonly link_checked_at: string | null;
};

type RefreshNeeded = {
  readonly stale_products_count: number;
  readonly stale_links_count: number;
  readonly stale_products: readonly RefreshNeededProduct[];
  readonly stale_links: readonly RefreshNeededLink[];
};

const refreshNeededProductSchema = z.object({
  id: z.string().min(1),
  product_name: z.string().min(1),
  price_checked_at: z.string().nullable(),
});

const refreshNeededLinkSchema = z.object({
  id: z.string().min(1),
  shopping_connect_url: z.string().min(1),
  link_checked_at: z.string().nullable(),
});

const refreshNeededSchema = z.object({
  stale_products_count: z.number().int().nonnegative(),
  stale_links_count: z.number().int().nonnegative(),
  stale_products: z.array(refreshNeededProductSchema),
  stale_links: z.array(refreshNeededLinkSchema),
});

const hqRefreshNeededResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    refresh_needed: refreshNeededSchema,
  }),
});

const emptyRefreshNeeded: RefreshNeeded = {
  stale_products_count: 0,
  stale_links_count: 0,
  stale_products: [],
  stale_links: [],
};

function checkedAtLabel(value: string | null): string {
  if (value === null) {
    return "확인일 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(
    new Date(value),
  );
}

function compactUrl(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

export function HqRefreshNeededPanel() {
  const [refreshNeeded, setRefreshNeeded] = useState<RefreshNeeded>(emptyRefreshNeeded);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    fetch("/api/hq/today")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("HQ_TODAY_FAILED");
        }
        return hqRefreshNeededResponseSchema.parse(await response.json());
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setRefreshNeeded(payload.data.refresh_needed);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof Error) {
          setStatus("error");
          return;
        }
        throw error;
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshNeededTotal =
    refreshNeeded.stale_products_count + refreshNeeded.stale_links_count;

  return (
    <section className="section-block">
      <h3>Refresh Needed ({refreshNeededTotal}개)</h3>
      {status === "loading" ? <p className="muted">갱신 필요 항목을 불러오는 중입니다.</p> : null}
      {status === "error" ? <p className="form-error">갱신 필요 항목을 불러오지 못했습니다.</p> : null}
      {status === "ready" && refreshNeededTotal === 0 ? (
        <p className="muted">갱신할 상품이나 링크가 없습니다.</p>
      ) : null}
      {status === "ready" && refreshNeededTotal > 0 ? (
        <div className="right-rail-list">
          <div>
            <p className="muted">가격 기준일 오래: {refreshNeeded.stale_products_count}건</p>
            {refreshNeeded.stale_products.slice(0, 2).map((product) => (
              <a className="rail-alert-row" href="/products" key={product.id}>
                <strong>{product.product_name}</strong>
                <span>{checkedAtLabel(product.price_checked_at)} 확인</span>
              </a>
            ))}
          </div>
          <div>
            <p className="muted">링크 상태 확인: {refreshNeeded.stale_links_count}건</p>
            {refreshNeeded.stale_links.slice(0, 2).map((link) => (
              <a className="rail-alert-row" href="/products" key={link.id}>
                <strong>{compactUrl(link.shopping_connect_url)}</strong>
                <span>{checkedAtLabel(link.link_checked_at)} 확인</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
