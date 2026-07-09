const sensitiveKeyFragments = ["password", "token", "secret", "authorization", "apikey"] as const;

export type JsonSafe =
  | string
  | number
  | boolean
  | null
  | readonly JsonSafe[]
  | { readonly [key: string]: JsonSafe };

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}

export function maskSensitiveContext(value: unknown): JsonSafe {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveContext(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? "[MASKED]" : maskSensitiveContext(item),
      ]),
    );
  }

  return String(value);
}
