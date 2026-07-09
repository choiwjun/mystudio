import type { Product, ShoppingConnectLink } from "@/components/products/types";

type ProductTableProps = {
  readonly products: readonly Product[];
  readonly emptyMessage: string;
  readonly onDeleteProduct: (product: Product) => void;
  readonly onEditProduct: (product: Product) => void;
  readonly onRefreshProduct: (product: Product) => void;
};
type ShoppingConnectLinkTableProps = {
  readonly links: readonly ShoppingConnectLink[];
  readonly products?: readonly Product[];
  readonly emptyMessage: string;
  readonly onConfirmLink?: (link: ShoppingConnectLink) => void;
  readonly onDeleteLink?: (link: ShoppingConnectLink) => void;
  readonly onEditLink?: (link: ShoppingConnectLink) => void;
  readonly onToggleLinkActive?: (link: ShoppingConnectLink) => void;
};

type RefreshNeededPanelProps = {
  readonly staleProducts: readonly Product[];
  readonly staleLinks: readonly ShoppingConnectLink[];
  readonly products: readonly Product[];
  readonly onDeleteProduct: (product: Product) => void;
  readonly onEditProduct: (product: Product) => void;
  readonly onRefreshProduct: (product: Product) => void;
  readonly onConfirmLink: (link: ShoppingConnectLink) => void;
  readonly onDeleteLink: (link: ShoppingConnectLink) => void;
  readonly onEditLink: (link: ShoppingConnectLink) => void;
  readonly onToggleLinkActive: (link: ShoppingConnectLink) => void;
};

function productPriceLabel(product: Product): string {
  return product.price === null ? "확인 필요" : `${product.price.toLocaleString("ko-KR")}원`;
}

function checkedAtLabel(value: string | null): string {
  return value === null ? "확인 이력 없음" : new Date(value).toLocaleDateString("ko-KR");
}
function productNameForLink(link: ShoppingConnectLink, products: readonly Product[] = []): string {
  return (
    products.find((product) => product.id === link.product_id)?.product_name ?? link.product_id
  );
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
                    <button
                      className="button"
                      onClick={() => props.onRefreshProduct(product)}
                      type="button"
                    >
                      갱신
                    </button>
                    <button
                      className="button"
                      onClick={() => props.onEditProduct(product)}
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      className="button"
                      onClick={() => props.onDeleteProduct(product)}
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
  );
}

function hasShoppingConnectLinkActions(props: ShoppingConnectLinkTableProps): boolean {
  return (
    props.onConfirmLink !== undefined ||
    props.onDeleteLink !== undefined ||
    props.onEditLink !== undefined ||
    props.onToggleLinkActive !== undefined
  );
}

export function ShoppingConnectLinkTable(props: ShoppingConnectLinkTableProps) {
  const hasActions = hasShoppingConnectLinkActions(props);

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>상품</th>
            <th>링크</th>
            <th>패키지</th>
            <th>수수료</th>
            <th>확인일</th>
            <th>상태</th>
            {hasActions ? <th>액션</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.links.length === 0 ? (
            <tr>
              <td colSpan={hasActions ? 7 : 6}>{props.emptyMessage}</td>
            </tr>
          ) : (
            props.links.map((link) => (
              <tr key={link.id}>
                <td>{productNameForLink(link, props.products)}</td>
                <td>{link.shopping_connect_url}</td>
                <td>{link.content_package_id ?? "미지정"}</td>
                <td>{link.commission_rate}%</td>
                <td>{checkedAtLabel(link.link_checked_at)}</td>
                <td>{link.stale ? "갱신 필요" : link.is_active ? "정상" : "비활성"}</td>
                {hasActions ? (
                  <td>
                    <div className="button-row compact-actions">
                      {props.onConfirmLink === undefined ? null : (
                        <button
                          className="button"
                          onClick={() => props.onConfirmLink?.(link)}
                          type="button"
                        >
                          확인
                        </button>
                      )}
                      {props.onEditLink === undefined ? null : (
                        <button
                          className="button"
                          onClick={() => props.onEditLink?.(link)}
                          type="button"
                        >
                          수정
                        </button>
                      )}
                      {props.onToggleLinkActive === undefined ? null : (
                        <button
                          className="button"
                          onClick={() => props.onToggleLinkActive?.(link)}
                          type="button"
                        >
                          {link.is_active ? "비활성화" : "활성화"}
                        </button>
                      )}
                      {props.onDeleteLink === undefined ? null : (
                        <button
                          className="button"
                          onClick={() => props.onDeleteLink?.(link)}
                          type="button"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                ) : null}
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
        <ShoppingConnectLinkTable
          emptyMessage="갱신할 링크가 없습니다."
          links={props.staleLinks}
          products={props.products}
          onConfirmLink={props.onConfirmLink}
          onDeleteLink={props.onDeleteLink}
          onEditLink={props.onEditLink}
          onToggleLinkActive={props.onToggleLinkActive}
        />
      </section>
    </div>
  );
}
