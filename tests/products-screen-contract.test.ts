import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productsSpecSource = readFileSync("specs/screens/products.yaml", "utf8");
const sharedComponentsSource = readFileSync("specs/shared/components.yaml", "utf8");
const resourcesSource = readFileSync("specs/domain/resources.yaml", "utf8");
const tasksSource = readFileSync("docs/planning/06-tasks.md", "utf8");
const productManagerSource = readFileSync("components/products/ProductManager.tsx", "utf8");
const productTablesSource = readFileSync("components/products/ProductTables.tsx", "utf8");
const productCreatePanelSource = readFileSync("components/products/ProductCreatePanel.tsx", "utf8");
const productSchemasSource = readFileSync("components/products/productSchemas.ts", "utf8");
const shoppingConnectRouteSource = readFileSync("app/api/shopping-connect-links/route.ts", "utf8");
const shoppingConnectLinkIdRouteSource = readFileSync(
  "app/api/shopping-connect-links/[id]/route.ts",
  "utf8",
);

describe("products screen contract", () => {
  it("keeps product CRUD and import fallback aligned with products.yaml", () => {
    expect(productsSpecSource).toContain("update_product");
    expect(productsSpecSource).toContain("delete_product");
    expect(productsSpecSource).toContain("fallback: manual_input_form");
    expect(sharedComponentsSource).toContain(
      'fallback: "If URL import is blocked, show manual input form."',
    );
    expect(resourcesSource).toContain("DELETE /api/products/:id");
    expect(tasksSource).toContain("상품 수정 및 삭제");

    expect(productManagerSource).toContain("productListResponseSchema");
    expect(productManagerSource).toContain("productMutationResponseSchema");
    expect(productManagerSource).toContain(".parse(await");
    expect(productManagerSource).toContain("saveProductEdit");
    expect(productManagerSource).toContain("deleteProduct");
    expect(productManagerSource).toContain('method: "DELETE"');
    expect(productManagerSource).toContain("수동 입력으로 등록하세요");
    expect(productManagerSource).toContain("hasProductImportBlockedFallback");
    expect(productManagerSource).toContain("PRODUCT_IMPORT_BLOCKED");
    expect(productTablesSource).toContain("onEditProduct");
    expect(productTablesSource).toContain("onDeleteProduct");
    expect(productTablesSource).toContain(">수정<");
    expect(productTablesSource).toContain(">삭제<");
  });

  it("exposes ShoppingConnect link creation next to product commerce workflows", () => {
    expect(shoppingConnectRouteSource).toContain("export const POST");
    expect(productSchemasSource).toContain("shoppingConnectLinkMutationResponseSchema");
    expect(productManagerSource).toContain("createShoppingConnectLink");
    expect(productManagerSource).toContain('fetch("/api/shopping-connect-links"');
    expect(productManagerSource).toContain("content_package_id");
    expect(productManagerSource).toContain("commission_rate");
    expect(productManagerSource).toContain("shopping_connect_url");
    expect(productCreatePanelSource).toContain("쇼핑커넥트 링크");
    expect(productCreatePanelSource).toContain("콘텐츠 패키지");
    expect(productCreatePanelSource).toContain("수수료");
    expect(productCreatePanelSource).toContain("onCreateShoppingConnectLink");
    expect(shoppingConnectLinkIdRouteSource).toContain("export async function PATCH");
    expect(shoppingConnectLinkIdRouteSource).toContain("export async function DELETE");
    expect(productManagerSource).toContain("saveShoppingConnectLinkEdit");
    expect(productManagerSource).toContain("toggleShoppingConnectLinkActive");
    expect(productManagerSource).toContain("deleteShoppingConnectLink");
    expect(productTablesSource).toContain("onEditLink");
    expect(productTablesSource).toContain("onToggleLinkActive");
    expect(productTablesSource).toContain("onDeleteLink");
  });
});
