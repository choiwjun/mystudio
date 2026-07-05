import type { ProductFormValues } from "@/components/products/types";

export const emptyProductForm: ProductFormValues = {
  product_name: "",
  price: "",
  category: "",
  memo: "",
};

export function toProductPatchInput(values: ProductFormValues) {
  return {
    product_name: values.product_name,
    price: values.price === "" ? undefined : Number.parseInt(values.price, 10),
    category: values.category,
    memo: values.memo,
  };
}
