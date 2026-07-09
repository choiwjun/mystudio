import { prisma } from "@/lib/db";

export type ApiRequestLogInput = {
  readonly routeName: string;
  readonly apiPath: string;
  readonly method: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly requestId: string;
  readonly errorCode?: string;
};

export async function recordApiRequestLog(input: ApiRequestLogInput): Promise<void> {
  await prisma.apiRequestLog.create({
    data: {
      routeName: input.routeName,
      apiPath: input.apiPath,
      method: input.method,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      requestId: input.requestId,
      ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
    },
  });
}
