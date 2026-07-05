"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCreatePanel } from "@/components/products/ProductCreatePanel";
import { ProductEditPanel } from "@/components/products/ProductEditPanel";
import { ProductTable, RefreshNeededPanel } from "@/components/products/ProductTables";
import { ProductTabs } from "@/components/products/ProductTabs";
import { emptyProductForm, toProductPatchInput } from "@/components/products/productForm";
import {
  productDeleteResponseSchema,
  productListResponseSchema,
  productMutationResponseSchema,
  sessionResponseSchema,
  shoppingConnectLinkListResponseSchema,
  shoppingConnectLinkMutationResponseSchema,
} from "@/components/products/productSchemas";
import type {
  Product,
  ProductFormValues,
  ProductTab,
  ShoppingConnectLink,
} from "@/components/products/types";

const emptyProducts: Product[] = [];
const emptyShoppingConnectLinks: ShoppingConnectLink[] = [];

export function ProductManager() {
  const [activeTab, setActiveTab] = useState<ProductTab>("registered");
  const [products, setProducts] = useState<Product[]>(emptyProducts);
  const [staleLinks, setStaleLinks] = useState<ShoppingConnectLink[]>(emptyShoppingConnectLinks);
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState("불러오는 중");
  const [importUrl, setImportUrl] = useState("");
  const [manualProduct, setManualProduct] = useState<ProductFormValues>(emptyProductForm);
  const [manualFallbackVisible, setManualFallbackVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productEdit, setProductEdit] = useState<ProductFormValues>(emptyProductForm);

  async function loadProducts(): Promise<void> {
    const [sessionResponse, productsResponse, staleLinksResponse] = await Promise.all([
      fetch("/api/auth/session"),
      fetch("/api/products"),
      fetch("/api/shopping-connect-links?stale=true"),
    ]);

    if (
      sessionResponse.status === 401 ||
      productsResponse.status === 401 ||
      staleLinksResponse.status === 401
    ) {
      window.location.assign("/login?from=/products");
      return;
    }

    if (!sessionResponse.ok || !productsResponse.ok || !staleLinksResponse.ok) {
      setStatus("불러오기 실패");
      return;
    }

    const sessionPayload = sessionResponseSchema.parse(await sessionResponse.json());
    const productsPayload = productListResponseSchema.parse(await productsResponse.json());
    const staleLinksPayload = shoppingConnectLinkListResponseSchema.parse(
      await staleLinksResponse.json(),
    );
    setCsrfToken(sessionPayload.data.csrf_token);
    setProducts(productsPayload.data.products);
    setStaleLinks(staleLinksPayload.data.shopping_connect_links);
    setStatus("저장됨");
  }

  useEffect(() => {
    void loadProducts().catch(() => setStatus("불러오기 실패"));
  }, []);

  const visibleProducts = useMemo(
    () => (activeTab === "refresh" ? products.filter((product) => product.stale) : products),
    [activeTab, products],
  );

  async function importProduct(): Promise<void> {
    setStatus("자동 크롤링 중");
    const response = await fetch("/api/products/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ url: importUrl }),
    });

    if (!response.ok) {
      setManualFallbackVisible(true);
      setStatus("수동 입력으로 등록하세요");
      return;
    }

    const payload = productMutationResponseSchema.parse(await response.json());
    setProducts([payload.data, ...products]);
    setManualFallbackVisible(false);
    setStatus("추가됨");
  }

  async function createManualProduct(): Promise<void> {
    setStatus("추가 중");
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        ...toProductPatchInput(manualProduct),
      }),
    });

    if (!response.ok) {
      setStatus("추가 실패");
      return;
    }

    const payload = productMutationResponseSchema.parse(await response.json());
    setProducts([payload.data, ...products]);
    setManualProduct(emptyProductForm);
    setManualFallbackVisible(false);
    setStatus("추가됨");
  }

  async function refreshProduct(product: Product): Promise<void> {
    const response = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ price: product.price ?? 0 }),
    });

    if (!response.ok) {
      setStatus("갱신 실패");
      return;
    }

    const payload = productMutationResponseSchema.parse(await response.json());
    setProducts(products.map((item) => (item.id === product.id ? payload.data : item)));
    setStatus("갱신됨");
  }

  function startProductEdit(product: Product): void {
    setEditingProductId(product.id);
    setProductEdit({
      product_name: product.product_name,
      price: product.price?.toString() ?? "",
      category: product.category ?? "",
      memo: product.memo ?? "",
    });
  }

  async function saveProductEdit(): Promise<void> {
    if (editingProductId === null) {
      return;
    }
    const response = await fetch(`/api/products/${editingProductId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(toProductPatchInput(productEdit)),
    });

    if (!response.ok) {
      setStatus("수정 실패");
      return;
    }

    const payload = productMutationResponseSchema.parse(await response.json());
    setProducts(products.map((item) => (item.id === editingProductId ? payload.data : item)));
    setEditingProductId(null);
    setProductEdit(emptyProductForm);
    setStatus("수정됨");
  }

  async function deleteProduct(product: Product): Promise<void> {
    if (!window.confirm(`${product.product_name} 상품을 삭제할까요?`)) {
      return;
    }
    const response = await fetch(`/api/products/${product.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken },
    });

    if (!response.ok) {
      setStatus("삭제 실패");
      return;
    }

    productDeleteResponseSchema.parse(await response.json());
    setProducts(products.filter((item) => item.id !== product.id));
    if (editingProductId === product.id) {
      setEditingProductId(null);
      setProductEdit(emptyProductForm);
    }
    setStatus("삭제됨");
  }

  async function confirmShoppingConnectLink(link: ShoppingConnectLink): Promise<void> {
    const response = await fetch(`/api/shopping-connect-links/${link.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ mark_checked: true }),
    });

    if (!response.ok) {
      setStatus("링크 확인 실패");
      return;
    }

    const payload = shoppingConnectLinkMutationResponseSchema.parse(await response.json());
    setStaleLinks(
      payload.data.stale
        ? staleLinks.map((item) => (item.id === link.id ? payload.data : item))
        : staleLinks.filter((item) => item.id !== link.id),
    );
    setStatus("링크 확인됨");
  }

  return (
    <section className="products-surface">
      <ProductTabs activeTab={activeTab} onTabChange={setActiveTab} status={status} />

      {activeTab === "new" ? (
        <ProductCreatePanel
          importUrl={importUrl}
          manualFallbackVisible={manualFallbackVisible}
          manualProduct={manualProduct}
          onCreateManualProduct={() => void createManualProduct()}
          onImportProduct={() => void importProduct()}
          onImportUrlChange={setImportUrl}
          onManualProductChange={setManualProduct}
        />
      ) : activeTab === "refresh" ? (
        <RefreshNeededPanel
          onConfirmLink={confirmShoppingConnectLink}
          onDeleteProduct={(product) => void deleteProduct(product)}
          onEditProduct={startProductEdit}
          onRefreshProduct={refreshProduct}
          staleLinks={staleLinks}
          staleProducts={visibleProducts}
        />
      ) : (
        <div className="table-panel">
          {editingProductId === null ? null : (
            <ProductEditPanel
              onCancel={() => {
                setEditingProductId(null);
                setProductEdit(emptyProductForm);
              }}
              onChange={setProductEdit}
              onSave={() => void saveProductEdit()}
              values={productEdit}
            />
          )}
          <ProductTable
            emptyMessage="표시할 상품이 없습니다."
            onDeleteProduct={(product) => void deleteProduct(product)}
            onEditProduct={startProductEdit}
            onRefreshProduct={refreshProduct}
            products={visibleProducts}
          />
        </div>
      )}
    </section>
  );
}
