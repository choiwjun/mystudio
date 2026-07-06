import type { Product, ShoppingConnectLink } from "@prisma/client";
import { serializeProduct } from "@/lib/products/service";

type ShoppingConnectLinkWithProduct = Pick<ShoppingConnectLink, "isActive"> & {
  readonly product: Product;
};

export function serializeActivePlacementProducts(links: readonly ShoppingConnectLinkWithProduct[]) {
  return links.filter((link) => link.isActive).map((link) => serializeProduct(link.product));
}
