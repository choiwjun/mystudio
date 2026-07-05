import { ProductManager } from "@/components/products/ProductManager";

export default function ProductsPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="brand">Revenue Desk</h1>
          <div className="muted">쇼핑커넥트 상품 등록, 링크 추적, 가격 갱신</div>
        </div>
      </header>
      <ProductManager />
    </>
  );
}
