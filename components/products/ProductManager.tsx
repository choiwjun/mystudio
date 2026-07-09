"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AffiliateAccountsPanel } from "@/components/products/AffiliateAccountsPanel";
import { AffiliateLinksPanel } from "@/components/products/AffiliateLinksPanel";
import { ProductCreatePanel } from "@/components/products/ProductCreatePanel";
import { ProductEditPanel } from "@/components/products/ProductEditPanel";
import {
  ProductTable,
  RefreshNeededPanel,
  ShoppingConnectLinkTable,
} from "@/components/products/ProductTables";
import { ProductTabs } from "@/components/products/ProductTabs";
import { emptyProductForm, toProductPatchInput } from "@/components/products/productForm";
import {
  contentPackageListResponseSchema,
  productDeleteResponseSchema,
  productListResponseSchema,
  productMutationResponseSchema,
  sessionResponseSchema,
  shoppingConnectLinkListResponseSchema,
  shoppingConnectLinkMutationResponseSchema,
} from "@/components/products/productSchemas";
import type {
  ContentPackageSummary,
  Product,
  ProductFormValues,
  ProductTab,
  ShoppingConnectLink,
  ShoppingConnectLinkFormValues,
} from "@/components/products/types";

const emptyProducts: Product[] = [];
const emptyShoppingConnectLinks: ShoppingConnectLink[] = [];
const emptyContentPackages: ContentPackageSummary[] = [];
const emptyShoppingConnectLinkForm: ShoppingConnectLinkFormValues = {
  product_id: "",
  content_package_id: "",
  shopping_connect_url: "",
  commission_rate: "",
  notes: "",
};

function tabFromHash(hash: string): ProductTab {
  switch (hash) {
    case "#accounts":
      return "accounts";
    case "#affiliate-links":
      return "affiliate_links";
    case "#new":
      return "new";
    case "#refresh":
      return "refresh";
    case "#links":
    case "":
      return "registered";
    default:
      return "registered";
  }
}

function shoppingConnectLinkToForm(link: ShoppingConnectLink): ShoppingConnectLinkFormValues {
  return {
    product_id: link.product_id,
    content_package_id: link.content_package_id ?? "",
    shopping_connect_url: link.shopping_connect_url,
    commission_rate: link.commission_rate.toString(),
    notes: link.notes ?? "",
  };
}

async function hasProductImportBlockedFallback(response: Response): Promise<boolean> {
  if (response.status !== 422) {
    return false;
  }
  const payload: unknown = await response.json().catch(() => null);
  if (payload === null || typeof payload !== "object" || !("error" in payload)) {
    return false;
  }
  const error = (payload as { readonly error?: { readonly code?: unknown } }).error;
  return error?.code === "PRODUCT_IMPORT_BLOCKED";
}

export function ProductManager() {
  const [activeTab, setActiveTab] = useState<ProductTab>("registered");
  const [products, setProducts] = useState<Product[]>(emptyProducts);
  const [contentPackages, setContentPackages] =
    useState<ContentPackageSummary[]>(emptyContentPackages);
  const [shoppingConnectLinks, setShoppingConnectLinks] =
    useState<ShoppingConnectLink[]>(emptyShoppingConnectLinks);
  const [staleLinks, setStaleLinks] = useState<ShoppingConnectLink[]>(emptyShoppingConnectLinks);
  const [csrfToken, setCsrfToken] = useState("");
  const [status, setStatus] = useState("불러오는 중");
  const [importUrl, setImportUrl] = useState("");
  const [manualProduct, setManualProduct] = useState<ProductFormValues>(emptyProductForm);
  const [manualFallbackVisible, setManualFallbackVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productEdit, setProductEdit] = useState<ProductFormValues>(emptyProductForm);
  const [linkForm, setLinkForm] = useState<ShoppingConnectLinkFormValues>(
    emptyShoppingConnectLinkForm,
  );
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkEdit, setLinkEdit] = useState<ShoppingConnectLinkFormValues>(
    emptyShoppingConnectLinkForm,
  );

  const loadProducts = useCallback(async (): Promise<void> => {
    const [sessionResponse, productsResponse, linksResponse, staleLinksResponse, packagesResponse] =
      await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/products"),
        fetch("/api/shopping-connect-links"),
        fetch("/api/shopping-connect-links?stale=true"),
        fetch("/api/content-packages"),
      ]);

    if (
      sessionResponse.status === 401 ||
      productsResponse.status === 401 ||
      linksResponse.status === 401 ||
      staleLinksResponse.status === 401 ||
      packagesResponse.status === 401
    ) {
      setStatus("세션 확인 실패");
      return;
    }

    if (
      !sessionResponse.ok ||
      !productsResponse.ok ||
      !linksResponse.ok ||
      !staleLinksResponse.ok ||
      !packagesResponse.ok
    ) {
      setStatus("불러오기 실패");
      return;
    }

    const sessionPayload = sessionResponseSchema.parse(await sessionResponse.json());
    const productsPayload = productListResponseSchema.parse(await productsResponse.json());
    const linksPayload = shoppingConnectLinkListResponseSchema.parse(await linksResponse.json());
    const staleLinksPayload = shoppingConnectLinkListResponseSchema.parse(
      await staleLinksResponse.json(),
    );
    const packagesPayload = contentPackageListResponseSchema.parse(await packagesResponse.json());
    setCsrfToken(sessionPayload.data.csrf_token);
    setProducts(productsPayload.data.products);
    setShoppingConnectLinks(linksPayload.data.shopping_connect_links);
    setStaleLinks(staleLinksPayload.data.shopping_connect_links);
    setContentPackages(packagesPayload.data.content_packages);
    setStatus("저장됨");
  }, []);

  useEffect(() => {
    void loadProducts().catch(() => setStatus("불러오기 실패"));
  }, [loadProducts]);

  useEffect(() => {
    function syncTabFromHash(): void {
      setActiveTab(tabFromHash(window.location.hash));
    }
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  function changeTab(tab: ProductTab): void {
    setActiveTab(tab);
    const hashByTab: Record<ProductTab, string> = {
      registered: "#links",
      new: "#new",
      refresh: "#refresh",
      accounts: "#accounts",
      affiliate_links: "#affiliate-links",
    };
    window.history.replaceState(null, "", hashByTab[tab]);
  }

  const visibleProducts = useMemo(
    () => (activeTab === "refresh" ? products.filter((product) => product.stale) : products),
    [activeTab, products],
  );

  function applyShoppingConnectLink(link: ShoppingConnectLink): void {
    setShoppingConnectLinks((currentLinks) =>
      currentLinks.some((item) => item.id === link.id)
        ? currentLinks.map((item) => (item.id === link.id ? link : item))
        : [link, ...currentLinks],
    );
    setStaleLinks((currentLinks) =>
      link.stale
        ? currentLinks.some((item) => item.id === link.id)
          ? currentLinks.map((item) => (item.id === link.id ? link : item))
          : [link, ...currentLinks]
        : currentLinks.filter((item) => item.id !== link.id),
    );
  }

  function removeShoppingConnectLink(linkId: string): void {
    setShoppingConnectLinks((currentLinks) => currentLinks.filter((item) => item.id !== linkId));
    setStaleLinks((currentLinks) => currentLinks.filter((item) => item.id !== linkId));
    if (editingLinkId === linkId) {
      setEditingLinkId(null);
      setLinkEdit(emptyShoppingConnectLinkForm);
    }
  }

  async function importProduct(): Promise<void> {
    setStatus("URL 정보 가져오는 중");
    const response = await fetch("/api/products/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ url: importUrl }),
    });

    if (!response.ok) {
      if (await hasProductImportBlockedFallback(response)) {
        setManualFallbackVisible(true);
        setStatus("수동 입력으로 등록하세요");
        return;
      }
      setManualFallbackVisible(false);
      setStatus("자동 가져오기 실패");
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

  async function createShoppingConnectLink(): Promise<void> {
    const commissionRate = Number(linkForm.commission_rate);
    if (
      linkForm.product_id.trim() === "" ||
      linkForm.shopping_connect_url.trim() === "" ||
      linkForm.commission_rate.trim() === "" ||
      !Number.isFinite(commissionRate) ||
      commissionRate < 0
    ) {
      setStatus("링크 필수값을 입력하세요");
      return;
    }
    setStatus("링크 추가 중");
    const response = await fetch("/api/shopping-connect-links", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        product_id: linkForm.product_id,
        ...(linkForm.content_package_id.trim() === ""
          ? {}
          : { content_package_id: linkForm.content_package_id }),
        shopping_connect_url: linkForm.shopping_connect_url,
        commission_rate: commissionRate,
        ...(linkForm.notes.trim() === "" ? {} : { notes: linkForm.notes }),
      }),
    });

    if (!response.ok) {
      setStatus("링크 추가 실패");
      return;
    }

    const payload = shoppingConnectLinkMutationResponseSchema.parse(await response.json());
    applyShoppingConnectLink(payload.data);
    setLinkForm(emptyShoppingConnectLinkForm);
    setStatus("링크 추가됨");
  }

  async function refreshProduct(product: Product): Promise<void> {
    const priceInput = window.prompt(
      product.price === null
        ? "현재 가격이 없습니다. 확인한 가격을 입력해야 갱신됩니다."
        : "확인한 최신 가격을 입력하세요.",
      product.price?.toString() ?? "",
    );
    if (priceInput === null) {
      return;
    }
    const price = Number.parseInt(priceInput.trim(), 10);
    if (priceInput.trim() === "" || !Number.isSafeInteger(price) || price < 0) {
      setStatus("가격을 입력해야 갱신됩니다");
      return;
    }

    const response = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ price }),
    });

    if (!response.ok) {
      setStatus("갱신 실패");
      return;
    }

    const payload = productMutationResponseSchema.parse(await response.json());
    setProducts(products.map((item) => (item.id === product.id ? payload.data : item)));
    setStatus("가격 확인됨");
  }

  function startProductEdit(product: Product): void {
    setEditingProductId(product.id);
    setProductEdit({
      product_name: product.product_name,
      price: product.price?.toString() ?? "",
      category: product.category ?? "",
      memo: product.memo ?? "",
      product_url: product.product_url,
      image_url: product.image_url ?? "",
      source: product.source,
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

  function startShoppingConnectLinkEdit(link: ShoppingConnectLink): void {
    setEditingLinkId(link.id);
    setLinkEdit(shoppingConnectLinkToForm(link));
  }

  async function saveShoppingConnectLinkEdit(): Promise<void> {
    if (editingLinkId === null) {
      return;
    }
    const commissionRate = Number(linkEdit.commission_rate);
    if (
      linkEdit.product_id.trim() === "" ||
      linkEdit.shopping_connect_url.trim() === "" ||
      linkEdit.commission_rate.trim() === "" ||
      !Number.isFinite(commissionRate) ||
      commissionRate < 0
    ) {
      setStatus("링크 필수값을 입력하세요");
      return;
    }

    const response = await fetch(`/api/shopping-connect-links/${editingLinkId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        product_id: linkEdit.product_id,
        content_package_id:
          linkEdit.content_package_id.trim() === "" ? null : linkEdit.content_package_id,
        shopping_connect_url: linkEdit.shopping_connect_url,
        commission_rate: commissionRate,
        notes: linkEdit.notes,
      }),
    });

    if (!response.ok) {
      setStatus("링크 수정 실패");
      return;
    }

    const payload = shoppingConnectLinkMutationResponseSchema.parse(await response.json());
    applyShoppingConnectLink(payload.data);
    setEditingLinkId(null);
    setLinkEdit(emptyShoppingConnectLinkForm);
    setStatus("링크 수정됨");
  }

  async function toggleShoppingConnectLinkActive(link: ShoppingConnectLink): Promise<void> {
    const response = await fetch(`/api/shopping-connect-links/${link.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ is_active: !link.is_active }),
    });

    if (!response.ok) {
      setStatus("링크 상태 변경 실패");
      return;
    }

    const payload = shoppingConnectLinkMutationResponseSchema.parse(await response.json());
    applyShoppingConnectLink(payload.data);
    setStatus(payload.data.is_active ? "링크 활성화됨" : "링크 비활성화됨");
  }

  async function deleteShoppingConnectLink(link: ShoppingConnectLink): Promise<void> {
    if (!window.confirm("쇼핑커넥트 링크를 삭제할까요?")) {
      return;
    }
    const response = await fetch(`/api/shopping-connect-links/${link.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrfToken },
    });

    if (!response.ok) {
      setStatus("링크 삭제 실패");
      return;
    }

    productDeleteResponseSchema.parse(await response.json());
    removeShoppingConnectLink(link.id);
    setStatus("링크 삭제됨");
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
    applyShoppingConnectLink(payload.data);
    setStatus("링크 확인됨");
  }

  return (
    <section className="products-surface">
      <ProductTabs activeTab={activeTab} onTabChange={changeTab} status={status} />

      {activeTab === "accounts" ? (
        <AffiliateAccountsPanel />
      ) : activeTab === "affiliate_links" ? (
        <AffiliateLinksPanel />
      ) : activeTab === "new" ? (
        <ProductCreatePanel
          contentPackages={contentPackages}
          importUrl={importUrl}
          linkForm={linkForm}
          manualFallbackVisible={manualFallbackVisible}
          manualProduct={manualProduct}
          onCreateManualProduct={() => void createManualProduct()}
          onCreateShoppingConnectLink={() => void createShoppingConnectLink()}
          onImportProduct={() => void importProduct()}
          onImportUrlChange={setImportUrl}
          onLinkFormChange={setLinkForm}
          onManualProductChange={setManualProduct}
          products={products}
        />
      ) : activeTab === "refresh" ? (
        <RefreshNeededPanel
          onConfirmLink={confirmShoppingConnectLink}
          onDeleteProduct={(product) => void deleteProduct(product)}
          onDeleteLink={(link) => void deleteShoppingConnectLink(link)}
          onEditProduct={startProductEdit}
          onEditLink={startShoppingConnectLinkEdit}
          onRefreshProduct={refreshProduct}
          onToggleLinkActive={(link) => void toggleShoppingConnectLinkActive(link)}
          products={products}
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
          <section className="table-panel">
            {editingLinkId === null ? null : (
              <section className="form-panel">
                <h2>쇼핑커넥트 링크 수정</h2>
                <label>
                  상품
                  <select
                    onChange={(event) =>
                      setLinkEdit({ ...linkEdit, product_id: event.target.value })
                    }
                    value={linkEdit.product_id}
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
                      setLinkEdit({ ...linkEdit, content_package_id: event.target.value })
                    }
                    value={linkEdit.content_package_id}
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
                      setLinkEdit({ ...linkEdit, shopping_connect_url: event.target.value })
                    }
                    value={linkEdit.shopping_connect_url}
                  />
                </label>
                <label>
                  수수료율(%)
                  <input
                    onChange={(event) =>
                      setLinkEdit({ ...linkEdit, commission_rate: event.target.value })
                    }
                    step="0.1"
                    type="number"
                    value={linkEdit.commission_rate}
                  />
                </label>
                <label>
                  메모
                  <textarea
                    onChange={(event) => setLinkEdit({ ...linkEdit, notes: event.target.value })}
                    rows={3}
                    value={linkEdit.notes}
                  />
                </label>
                <div className="button-row">
                  <button
                    className="button primary"
                    onClick={() => void saveShoppingConnectLinkEdit()}
                    type="button"
                  >
                    링크 저장
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      setEditingLinkId(null);
                      setLinkEdit(emptyShoppingConnectLinkForm);
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              </section>
            )}
            <h2>쇼핑커넥트 링크</h2>
            <ShoppingConnectLinkTable
              emptyMessage="등록된 쇼핑커넥트 링크가 없습니다."
              links={shoppingConnectLinks}
              products={products}
              onDeleteLink={(link) => void deleteShoppingConnectLink(link)}
              onEditLink={startShoppingConnectLinkEdit}
              onToggleLinkActive={(link) => void toggleShoppingConnectLinkActive(link)}
            />
          </section>
        </div>
      )}
    </section>
  );
}
