import { Prisma } from "@prisma/client";
import { hasDatabaseUrl, prisma } from "@/lib/db";
import { type JsonSafe, maskSensitiveContext } from "@/lib/security/mask";

export type ErrorSeverity = "low" | "medium" | "high";

export type ErrorLogInput = {
  readonly errorCode: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly stackTrace?: string;
  readonly context?: unknown;
};

export async function recordErrorLog(input: ErrorLogInput): Promise<void> {
  if (process.env["ERROR_LOG_ENABLED"] === "false" || !hasDatabaseUrl()) {
    return;
  }

  const maskedContext: JsonSafe | undefined =
    input.context === undefined ? undefined : maskSensitiveContext(input.context);
  const context =
    maskedContext === undefined
      ? {}
      : {
          context: maskedContext === null ? Prisma.JsonNull : maskedContext,
        };

  await prisma.errorLog.create({
    data: {
      errorCode: input.errorCode,
      message: input.message,
      severity: input.severity,
      ...(input.stackTrace === undefined ? {} : { stackTrace: input.stackTrace }),
      ...context,
    },
  });
}
