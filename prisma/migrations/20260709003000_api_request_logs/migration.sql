CREATE TABLE "api_request_logs" (
    "id" TEXT NOT NULL,
    "route_name" TEXT NOT NULL,
    "api_path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "request_id" TEXT NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_request_logs_route_name_created_at_idx" ON "api_request_logs"("route_name", "created_at");
CREATE INDEX "api_request_logs_status_code_created_at_idx" ON "api_request_logs"("status_code", "created_at");
