import type { ProductFormValues } from "@/components/products/types";

type ProductEditPanelProps = {
  readonly values: ProductFormValues;
  readonly onCancel: () => void;
  readonly onChange: (value: ProductFormValues) => void;
  readonly onSave: () => void;
};

export function ProductEditPanel({ values, onCancel, onChange, onSave }: ProductEditPanelProps) {
  return (
    <section className="form-panel">
      <h2>상품 수정</h2>
      <div className="form-row">
        <label>
          상품명
          <input
            onChange={(event) => onChange({ ...values, product_name: event.target.value })}
            value={values.product_name}
          />
        </label>
        <label>
          가격
          <input
            onChange={(event) => onChange({ ...values, price: event.target.value })}
            type="number"
            value={values.price}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          카테고리
          <input
            onChange={(event) => onChange({ ...values, category: event.target.value })}
            value={values.category}
          />
        </label>
        <label>
          메모
          <input
            onChange={(event) => onChange({ ...values, memo: event.target.value })}
            value={values.memo}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          상품 URL
          <input
            onChange={(event) => onChange({ ...values, product_url: event.target.value })}
            value={values.product_url}
          />
        </label>
        <label>
          이미지 URL
          <input
            onChange={(event) => onChange({ ...values, image_url: event.target.value })}
            value={values.image_url}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          출처
          <input
            onChange={(event) => onChange({ ...values, source: event.target.value })}
            value={values.source}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="button primary" onClick={onSave} type="button">
          수정 저장
        </button>
        <button className="button" onClick={onCancel} type="button">
          취소
        </button>
      </div>
    </section>
  );
}
