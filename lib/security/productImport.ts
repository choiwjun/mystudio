import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const allowedHosts = new Set(["search.shopping.naver.com", "shopping.naver.com"]);
const maxProductImportUrlLength = 2048;
export type ProductImportUrlFailureReason = "invalid_url" | "blocked_domain" | "private_ip";

export type ProductImportUrlResult =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly reason: ProductImportUrlFailureReason };

export async function validateProductImportUrl(input: string): Promise<ProductImportUrlResult> {
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0 || trimmedInput.length > maxProductImportUrlLength) {
    return { ok: false, reason: "invalid_url" };
  }

  let url: URL;
  try {
    url = new URL(trimmedInput);
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

function parseIpv6Hextet(value: string): number | null {
  if (!/^[0-9a-f]{1,4}$/.test(value)) {
    return null;
  }
  return Number.parseInt(value, 16);
}

function isPrivateIpv4Address(address: string): boolean {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return true;
  }

  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) {
    return true;
  }

  if (version === 4) {
    return isPrivateIpv4Address(address);
  }

  const normalizedAddress = address.toLowerCase();
  if (normalizedAddress.startsWith("::ffff:")) {
    return isPrivateIpv4Address(normalizedAddress.slice("::ffff:".length));
  }

  const hextets = normalizedAddress.split(":");
  const firstHextetNumber = parseIpv6Hextet(hextets[0] ?? "");
  const secondHextetNumber = parseIpv6Hextet(hextets[1] === "" ? "0" : (hextets[1] ?? ""));
  if (firstHextetNumber === null) {
    return true;
  }

  return (
    normalizedAddress === "::" ||
    normalizedAddress === "::1" ||
    (firstHextetNumber & 0xfe00) === 0xfc00 ||
    (firstHextetNumber & 0xff00) === 0xff00 ||
    (firstHextetNumber & 0xffc0) === 0xfe80 ||
    (firstHextetNumber === 0x0064 && secondHextetNumber === 0xff9b) ||
    firstHextetNumber === 0x0100 ||
    (firstHextetNumber === 0x2001 &&
      secondHextetNumber !== null &&
      (secondHextetNumber <= 0x01ff || secondHextetNumber === 0x0db8)) ||
    firstHextetNumber === 0x2002 ||
    (firstHextetNumber & 0xfff0) === 0x3ff0
  );
}
