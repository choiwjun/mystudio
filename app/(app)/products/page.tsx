import { ProductManager } from "@/components/products/ProductManager";

export default function ProductsPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">제휴/어필리에이트 수익</h1>
          <div className="muted">다계정 제휴 채널, 쇼핑커넥트 상품, 어필리에이트 링크 추적</div>
        </div>
      </header>
      <ProductManager />
    </>
  );
}
