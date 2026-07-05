import type { ProductFormValues } from "@/components/products/types";

type ProductCreatePanelProps = {
  readonly importUrl: string;
  readonly manualFallbackVisible: boolean;
  readonly manualProduct: ProductFormValues;
  readonly onCreateManualProduct: () => void;
  readonly onImportProduct: () => void;
  readonly onImportUrlChange: (value: string) => void;
  readonly onManualProductChange: (value: ProductFormValues) => void;
};

export function ProductCreatePanel({
  importUrl,
  manualFallbackVisible,
  manualProduct,
  onCreateManualProduct,
  onImportProduct,
  onImportUrlChange,
  onManualProductChange,
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
          자동 크롤링
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
    </div>
  );
}
