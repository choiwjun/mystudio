import { PrismaClient } from "@prisma/client";

export function hasDatabaseUrl(): boolean {
  return (process.env["DATABASE_URL"] ?? "").trim().length > 0;
}

export function isMissingDatabaseConfigurationError(error: unknown): boolean {
  if (hasDatabaseUrl()) {
    return false;
  }
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.includes("DATABASE_URL") || message.includes("PrismaClientInitializationError");
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    message.includes("Can't reach database server") ||
    message.includes("PrismaClientInitializationError")
  );
}

export function canUseMissingDatabaseFallback(error: unknown): boolean {
  return (
    process.env["NODE_ENV"] !== "production" &&
    (isMissingDatabaseConfigurationError(error) || isDatabaseUnavailableError(error))
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
