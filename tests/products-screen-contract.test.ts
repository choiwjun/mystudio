import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productsSpecSource = readFileSync("specs/screens/products.yaml", "utf8");
const sharedComponentsSource = readFileSync("specs/shared/components.yaml", "utf8");
const resourcesSource = readFileSync("specs/domain/resources.yaml", "utf8");
const tasksSource = readFileSync("docs/planning/06-tasks.md", "utf8");
const productManagerSource = readFileSync("components/products/ProductManager.tsx", "utf8");
const productTablesSource = readFileSync("components/products/ProductTables.tsx", "utf8");
const productCreatePanelSource = readFileSync("components/products/ProductCreatePanel.tsx", "utf8");
const productEditPanelSource = readFileSync("components/products/ProductEditPanel.tsx", "utf8");
const productTypesSource = readFileSync("components/products/types.ts", "utf8");
const productFormSource = readFileSync("components/products/productForm.ts", "utf8");
const productSchemasSource = readFileSync("components/products/productSchemas.ts", "utf8");
const shoppingConnectRouteSource = readFileSync("app/api/shopping-connect-links/route.ts", "utf8");
const productImportRouteSource = readFileSync("app/api/products/import/route.ts", "utf8");
const productServiceSource = readFileSync("lib/products/service.ts", "utf8");
const productImportSecuritySource = readFileSync("lib/security/productImport.ts", "utf8");
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

  it("keeps manual product create and edit fields wired through form values, panels, and manager", () => {
    const productFormValuesBlock =
      productTypesSource.match(/export type ProductFormValues = \{[\s\S]*?\};/)?.[0] ?? "";

    for (const field of ["product_url", "image_url", "source"]) {
      expect(productFormValuesBlock).toContain(`readonly ${field}: string`);
      expect(productFormSource).toContain(field === "source" ? 'source: "manual"' : `${field}: ""`);
      const patchValue =
        field === "product_url" ? "productUrl" : field === "image_url" ? "imageUrl" : "source";
      expect(productFormSource).toContain(
        field === "source" ? "{ source }" : `{ ${field}: ${patchValue} }`,
      );
      expect(productCreatePanelSource).toContain(`manualProduct.${field}`);
      expect(productCreatePanelSource).toContain(`...manualProduct, ${field}: event.target.value`);
      expect(productEditPanelSource).toContain(`values.${field}`);
      expect(productEditPanelSource).toContain(`...values, ${field}: event.target.value`);
      expect(productManagerSource).toContain(`${field}: product.${field}`);
    }

    expect(productManagerSource).toContain("setManualProduct(emptyProductForm)");
    expect(productManagerSource).toContain("setProductEdit(emptyProductForm)");
    expect(productManagerSource).toContain("JSON.stringify({");
    expect(productManagerSource).toContain("...toProductPatchInput(manualProduct)");
    expect(productManagerSource).toContain("JSON.stringify(toProductPatchInput(productEdit))");
  });

  it("keeps automatic product import behind the SSRF gate", () => {
    expect(productImportRouteSource).toContain('code: "PRODUCT_IMPORT_BLOCKED"');
    expect(productImportRouteSource).toContain("Use manual input");
    expect(productServiceSource).toContain(
      'import { validateProductImportUrl } from "@/lib/security/productImport"',
    );
    expect(productServiceSource).toContain(
      "const validatedUrl = await validateProductImportUrl(input.url)",
    );
    expect(productServiceSource).toContain("if (!validatedUrl.ok)");
    expect(productServiceSource).toContain("parseNaverProductFromUrl(validatedUrl.url)");

    expect(productCreatePanelSource).toContain("URL 정보 가져오기");
    expect(productCreatePanelSource).not.toContain("자동 크롤링");
    expect(productManagerSource).toContain("URL 정보 가져오는 중");
    expect(productManagerSource).not.toContain("자동 크롤링");

    expect(productImportSecuritySource).toContain(
      'new Set(["search.shopping.naver.com", "shopping.naver.com"])',
    );
    expect(productImportSecuritySource).toContain('url.protocol !== "https:"');
    expect(productImportSecuritySource).toContain("!allowedHosts.has(url.hostname)");
    expect(productImportSecuritySource).toContain("await lookup(url.hostname, { all: true })");
    expect(productImportSecuritySource).toContain(
      "addresses.some((address) => isPrivateAddress(address.address))",
    );
    expect(productImportSecuritySource).toContain('reason: "private_ip"');
    expect(productImportSecuritySource).toContain("first === 10");
    expect(productImportSecuritySource).toContain("first === 127");
    expect(productImportSecuritySource).toContain("first === 100 && second >= 64 && second <= 127");
    expect(productImportSecuritySource).toContain("first === 172 && second >= 16 && second <= 31");
    expect(productImportSecuritySource).toContain(
      "first === 192 && (second === 0 || second === 168)",
    );
    expect(productImportSecuritySource).toContain("first === 169 && second === 254");
    expect(productImportSecuritySource).toContain(
      "first === 198 && (second === 18 || second === 19)",
    );
    expect(productImportSecuritySource).toContain("first >= 224");
    expect(productImportSecuritySource).toContain('normalizedAddress === "::1"');
    expect(productImportSecuritySource).toContain("(firstHextetNumber & 0xfe00) === 0xfc00");
    expect(productImportSecuritySource).toContain("(firstHextetNumber & 0xff00) === 0xff00");
    expect(productImportSecuritySource).toContain("(firstHextetNumber & 0xffc0) === 0xfe80");
    expect(productImportSecuritySource).toContain(
      "firstHextetNumber === 0x0064 && secondHextetNumber === 0xff9b",
    );
    expect(productImportSecuritySource).toContain("firstHextetNumber === 0x0100");
    expect(productImportSecuritySource).toContain("secondHextetNumber <= 0x01ff");
    expect(productImportSecuritySource).toContain("secondHextetNumber === 0x0db8");
    expect(productImportSecuritySource).toContain("firstHextetNumber === 0x2002");
    expect(productImportSecuritySource).toContain("(firstHextetNumber & 0xfff0) === 0x3ff0");
    expect(productImportSecuritySource).toContain('normalizedAddress.startsWith("::ffff:")');
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
