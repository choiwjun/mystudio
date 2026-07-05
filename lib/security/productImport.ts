import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const allowedHosts = new Set(["search.shopping.naver.com", "shopping.naver.com"]);

export type ProductImportUrlResult =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly reason: "invalid_url" | "blocked_domain" | "private_ip" };

export async function validateProductImportUrl(input: string): Promise<ProductImportUrlResult> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    return { ok: false, reason: "blocked_domain" };
  }

  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((address) => isPrivateAddress(address.address))) {
    return { ok: false, reason: "private_ip" };
  }

  return { ok: true, url };
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) {
    return true;
  }

  if (version === 6) {
    return (
      address === "::1" ||
      address.toLowerCase().startsWith("fc") ||
      address.toLowerCase().startsWith("fd") ||
      address.toLowerCase().startsWith("fe80:")
    );
  }

  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  const [first, second] = octets;
  if (first === undefined || second === undefined) {
    return true;
  }

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}
