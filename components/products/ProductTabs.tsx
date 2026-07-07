import type { ProductTab } from "@/components/products/types";

type ProductTabsProps = {
  readonly activeTab: ProductTab;
  readonly status: string;
  readonly onTabChange: (tab: ProductTab) => void;
};

export function ProductTabs({ activeTab, status, onTabChange }: ProductTabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="상품 관리 탭">
      <button
        role="tab"
        aria-selected={activeTab === "registered"}
        className="tab-button"
        onClick={() => onTabChange("registered")}
        type="button"
      >
        등록된 상품
      </button>
      <button
        role="tab"
        aria-selected={activeTab === "new"}
        className="tab-button"
        onClick={() => onTabChange("new")}
        type="button"
      >
        새 상품
      </button>
      <button
        role="tab"
        aria-selected={activeTab === "refresh"}
        className="tab-button"
        onClick={() => onTabChange("refresh")}
        type="button"
      >
        갱신 필요
      </button>
      <span className="badge">{status}</span>
    </div>
  );
}
