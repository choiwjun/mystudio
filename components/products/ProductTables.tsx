import type { Product, ShoppingConnectLink } from "@/components/products/types";

type ProductTableProps = {
  readonly products: readonly Product[];
  readonly emptyMessage: string;
  readonly onDeleteProduct: (product: Product) => void;
  readonly onEditProduct: (product: Product) => void;
  readonly onRefreshProduct: (product: Product) => void;
};

type RefreshNeededPanelProps = {
  readonly staleProducts: readonly Product[];
  readonly staleLinks: readonly ShoppingConnectLink[];
  readonly onDeleteProduct: (product: Product) => void;
  readonly onEditProduct: (product: Product) => void;
  readonly onRefreshProduct: (product: Product) => void;
  readonly onConfirmLink: (link: ShoppingConnectLink) => void;
};

function productPriceLabel(product: Product): string {
  return product.price === null ? "확인 필요" : `${product.price.toLocaleString("ko-KR")}원`;
}

function checkedAtLabel(value: string | null): string {
  return value === null ? "확인 이력 없음" : new Date(value).toLocaleDateString("ko-KR");
}

export function ProductTable(props: ProductTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>상품명</th>
            <th>가격</th>
            <th>수수료</th>
            <th>상태</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {props.products.length === 0 ? (
            <tr>
              <td colSpan={5}>{props.emptyMessage}</td>
            </tr>
          ) : (
            props.products.map((product) => (
              <tr key={product.id}>
                <td>{product.product_name}</td>
                <td>{productPriceLabel(product)}</td>
                <td>링크별 적용</td>
                <td>{product.stale ? "갱신 필요" : "정상"}</td>
                <td>
                  <div className="button-row compact-actions">
                    <button className="button" onClick={() => props.onRefreshProduct(product)} type="button">
                      갱신
                    </button>
                    <button className="button" onClick={() => props.onEditProduct(product)} type="button">수정</button>
                    <button className="button" onClick={() => props.onDeleteProduct(product)} type="button">삭제</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function RefreshNeededPanel(props: RefreshNeededPanelProps) {
  return (
    <div className="refresh-needed-grid">
      <section className="table-panel">
        <h2>갱신 필요 상품</h2>
        <ProductTable
          emptyMessage="갱신할 상품이 없습니다."
          onDeleteProduct={props.onDeleteProduct}
          onEditProduct={props.onEditProduct}
          onRefreshProduct={props.onRefreshProduct}
          products={props.staleProducts}
        />
      </section>

      <section className="table-panel">
        <h2>갱신 필요 링크</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>링크</th>
                <th>수수료</th>
                <th>확인일</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {props.staleLinks.length === 0 ? (
                <tr>
                  <td colSpan={5}>갱신할 링크가 없습니다.</td>
                </tr>
              ) : (
                props.staleLinks.map((link) => (
                  <tr key={link.id}>
                    <td>{link.shopping_connect_url}</td>
                    <td>{link.commission_rate}%</td>
                    <td>{checkedAtLabel(link.link_checked_at)}</td>
                    <td>{link.stale ? "갱신 필요" : "정상"}</td>
                    <td>
                      <button className="button" onClick={() => props.onConfirmLink(link)} type="button">
                        확인
                      </button>
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
