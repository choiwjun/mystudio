import type { ProductFormValues } from "@/components/products/types";

export const emptyProductForm: ProductFormValues = {
  product_name: "",
  price: "",
  category: "",
  memo: "",
  product_url: "",
  image_url: "",
  source: "manual",
};

export function toProductPatchInput(values: ProductFormValues) {
  const productUrl = values.product_url.trim();
  const imageUrl = values.image_url.trim();
  const source = values.source.trim();

  return {
    product_name: values.product_name,
    price: values.price === "" ? undefined : Number.parseInt(values.price, 10),
    category: values.category,
    memo: values.memo,
    ...(productUrl === "" ? {} : { product_url: productUrl }),
    ...(imageUrl === "" ? {} : { image_url: imageUrl }),
    ...(source === "" ? {} : { source }),
  };
}
