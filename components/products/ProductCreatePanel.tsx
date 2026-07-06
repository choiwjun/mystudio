import type {
  ContentPackageSummary,
  Product,
  ProductFormValues,
  ShoppingConnectLinkFormValues,
} from "@/components/products/types";

type ProductCreatePanelProps = {
  readonly importUrl: string;
  readonly manualFallbackVisible: boolean;
  readonly manualProduct: ProductFormValues;
  readonly contentPackages: readonly ContentPackageSummary[];
  readonly linkForm: ShoppingConnectLinkFormValues;
  readonly onCreateManualProduct: () => void;
  readonly onImportProduct: () => void;
  readonly onImportUrlChange: (value: string) => void;
  readonly onManualProductChange: (value: ProductFormValues) => void;
  readonly onCreateShoppingConnectLink: () => void;
  readonly onLinkFormChange: (value: ShoppingConnectLinkFormValues) => void;
  readonly products: readonly Product[];
};

export function ProductCreatePanel({
  importUrl,
  manualFallbackVisible,
  manualProduct,
  contentPackages,
  linkForm,
  onCreateManualProduct,
  onImportProduct,
  onImportUrlChange,
  onManualProductChange,
  onCreateShoppingConnectLink,
  onLinkFormChange,
  products,
}: ProductCreatePanelProps) {
  return (
    <div className="product-create-grid">
      <section className="form-panel">
        <h2>URL 붙여넣기</h2>
        <label>
          네이버 쇼핑 URL
          <input
            onChange={(event) => onImportUrlChange(event.target.value)}
            placeholder="https://search.shopping.naver.com/..."
            value={importUrl}
          />
        </label>
        {manualFallbackVisible ? (
          <p className="form-error">자동 가져오기가 차단되었습니다. 수동 입력으로 등록하세요.</p>
        ) : null}
        <button className="button primary" onClick={onImportProduct} type="button">
          URL 정보 가져오기
        </button>
      </section>

      <section className="form-panel">
        <h2>수동 입력</h2>
        <label>
          상품명
          <input
            onChange={(event) =>
              onManualProductChange({ ...manualProduct, product_name: event.target.value })
            }
            value={manualProduct.product_name}
          />
        </label>
        <label>
          가격
          <input
            onChange={(event) => onManualProductChange({ ...manualProduct, price: event.target.value })}
            type="number"
            value={manualProduct.price}
          />
        </label>
        <label>
          카테고리
          <input
            onChange={(event) => onManualProductChange({ ...manualProduct, category: event.target.value })}
            value={manualProduct.category}
          />
        </label>
        <label>
          상품 URL
          <input
            onChange={(event) =>
              onManualProductChange({ ...manualProduct, product_url: event.target.value })
            }
            placeholder="https://..."
            value={manualProduct.product_url}
          />
        </label>
        <label>
          이미지 URL
          <input
            onChange={(event) =>
              onManualProductChange({ ...manualProduct, image_url: event.target.value })
            }
            placeholder="https://..."
            value={manualProduct.image_url}
          />
        </label>
        <label>
          출처
          <input
            onChange={(event) => onManualProductChange({ ...manualProduct, source: event.target.value })}
            value={manualProduct.source}
          />
        </label>
        <label>
          메모
          <textarea
            onChange={(event) => onManualProductChange({ ...manualProduct, memo: event.target.value })}
            rows={3}
            value={manualProduct.memo}
          />
        </label>
        <button className="button primary" onClick={onCreateManualProduct} type="button">
          추가
        </button>
      </section>

      <section className="form-panel">
        <h2>쇼핑커넥트 링크</h2>
        <label>
          상품
          <select
            onChange={(event) => onLinkFormChange({ ...linkForm, product_id: event.target.value })}
            value={linkForm.product_id}
          >
            <option value="">상품 선택</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          콘텐츠 패키지(선택)
          <select
            onChange={(event) =>
              onLinkFormChange({ ...linkForm, content_package_id: event.target.value })
            }
            value={linkForm.content_package_id}
          >
            <option value="">패키지 미지정</option>
            {contentPackages.slice(0, 20).map((contentPackage) => (
              <option key={contentPackage.id} value={contentPackage.id}>
                {contentPackage.topic.title} · {contentPackage.status}
              </option>
            ))}
          </select>
        </label>
        <label>
          쇼핑커넥트 URL
          <input
            onChange={(event) =>
              onLinkFormChange({ ...linkForm, shopping_connect_url: event.target.value })
            }
            placeholder="https://..."
            value={linkForm.shopping_connect_url}
          />
        </label>
        <label>
          수수료율(%)
          <input
            onChange={(event) => onLinkFormChange({ ...linkForm, commission_rate: event.target.value })}
            step="0.1"
            type="number"
            value={linkForm.commission_rate}
          />
        </label>
        <label>
          메모
          <textarea
            onChange={(event) => onLinkFormChange({ ...linkForm, notes: event.target.value })}
            rows={3}
            value={linkForm.notes}
          />
        </label>
        <button className="button primary" onClick={onCreateShoppingConnectLink} type="button">
          링크 추가
        </button>
      </section>
    </div>
  );
}
