-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('opportunity_found', 'paperclip_review', 'selected', 'assigned', 'brief_created', 'homefeed_packaged', 'search_structured', 'revenue_links_attached', 'blog_draft_generated', 'sns_repurposed', 'compliance_checked', 'owner_approval_required', 'approved', 'exported', 'published_manually', 'performance_recorded', 'memory_updated', 'archived', 'rejected', 'duplicate', 'stale', 'needs_research', 'needs_link_refresh', 'compliance_failed', 'price_outdated', 'policy_risk', 'low_revenue_fit', 'low_homefeed_fit');

-- CreateEnum
CREATE TYPE "DecisionValue" AS ENUM ('selected', 'on_hold', 'rejected');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('markdown', 'html', 'copy', 'zip');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profile" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL DEFAULT 'My Company',
    "primary_categories" TEXT[],
    "blocked_categories" TEXT[],
    "tone_rules" TEXT NOT NULL,
    "content_principles" TEXT NOT NULL,
    "revenue_goal_monthly" INTEGER NOT NULL DEFAULT 500000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hq_briefing" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goals" TEXT NOT NULL,
    "focus_categories" TEXT[],
    "priority_angle" TEXT NOT NULL,
    "strategy_note" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hq_briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "api_endpoint" TEXT NOT NULL,
    "last_scanned_at" TIMESTAMP(3),
    "next_scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_items" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_memos" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "why_now" TEXT NOT NULL,
    "homefeed_angle" TEXT NOT NULL,
    "search_angle" TEXT NOT NULL,
    "interest_tags" TEXT[],
    "homefeed_score" INTEGER NOT NULL,
    "homefeed_reasons" TEXT,
    "search_score" INTEGER NOT NULL,
    "search_reasons" TEXT,
    "revenue_score" INTEGER NOT NULL,
    "revenue_reasons" TEXT,
    "risk_score" INTEGER NOT NULL,
    "score_reasons" TEXT,
    "recommended_packages" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'opportunity_found',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paperclip_decisions" (
    "id" TEXT NOT NULL,
    "opportunity_memo_id" TEXT,
    "decision" "DecisionValue" NOT NULL,
    "reason_json" JSONB,
    "assigned_profiles" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 5,
    "requires_owner_approval" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paperclip_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "paperclip_decision_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_clusters" (
    "id" TEXT NOT NULL,
    "opportunity_memo_id" TEXT NOT NULL,
    "primary_keyword" TEXT NOT NULL,
    "related_keywords" TEXT[],
    "search_volume" INTEGER,
    "competition_score" INTEGER,

    CONSTRAINT "keyword_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_packages" (
    "id" TEXT NOT NULL,
    "paperclip_decision_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "homefeed_score" INTEGER,
    "search_score" INTEGER,
    "revenue_score" INTEGER,
    "risk_score" INTEGER,
    "publish_readiness" TEXT NOT NULL DEFAULT 'not_ready',
    "progress" DOUBLE PRECISION,
    "published_at" TIMESTAMP(3),
    "status" "PackageStatus" NOT NULL DEFAULT 'assigned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "content_package_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "homefeed_title" TEXT[],
    "search_title" TEXT,
    "thumbnail_text" TEXT[],
    "first_screen" TEXT,
    "body_markdown" TEXT,
    "comparison_table" TEXT,
    "faq" JSONB,
    "disclosure_text" TEXT,
    "price_notice" TEXT,
    "original_body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sns_variants" (
    "id" TEXT NOT NULL,
    "content_package_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "hook" TEXT,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "hashtags" TEXT[],
    "score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sns_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "title_candidates" (
    "id" TEXT NOT NULL,
    "content_package_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hook_type" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "title_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "content_package_id" TEXT NOT NULL,
    "draft_id" TEXT,
    "compliance_check_id" TEXT,
    "format" "ExportFormat" NOT NULL,
    "channel" TEXT,
    "content" TEXT NOT NULL,
    "storage_key" TEXT,
    "bundle_filename" TEXT,
    "byte_size" INTEGER,
    "checksum_sha256" TEXT,
    "manifest_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "price" INTEGER,
    "price_checked_at" TIMESTAMP(3),
    "image_url" TEXT,
    "category" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_connect_links" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "content_package_id" TEXT,
    "shopping_connect_url" TEXT NOT NULL,
    "commission_rate" DOUBLE PRECISION NOT NULL,
    "bonus_commission" DOUBLE PRECISION,
    "link_checked_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_connect_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_checks" (
    "id" TEXT NOT NULL,
    "content_package_id" TEXT NOT NULL,
    "draft_id" TEXT,
    "risk_level" TEXT NOT NULL,
    "pass" BOOLEAN NOT NULL DEFAULT false,
    "export_allowed" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_issues" (
    "id" TEXT NOT NULL,
    "compliance_check_id" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggested_fix" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by" TEXT,
    "dismiss_reason" TEXT,

    CONSTRAINT "compliance_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_transitions" (
    "id" TEXT NOT NULL,
    "content_package_id" TEXT NOT NULL,
    "from_status" "PackageStatus" NOT NULL,
    "to_status" "PackageStatus" NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_logs" (
    "id" TEXT NOT NULL,
    "content_package_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "post_url" TEXT NOT NULL,
    "hook_type" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER,
    "direct_revenue" INTEGER,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_logs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "revenue_type" TEXT NOT NULL,
    "referrer_url" TEXT,
    "ordered_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_logs" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "pipeline_step" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "blocked_by_cap" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "error_code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack_trace" TEXT,
    "context" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memory" (
    "id" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "category" TEXT,
    "pattern_text" TEXT NOT NULL,
    "tags" TEXT[],
    "result_summary" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "avg_views" DOUBLE PRECISION,
    "avg_clicks" DOUBLE PRECISION,
    "avg_revenue_usd" DOUBLE PRECISION,
    "created_pattern_ids" TEXT[],
    "used_in_recommendations" INTEGER NOT NULL DEFAULT 0,
    "evidence_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "template" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "trigger_execution_id" TEXT,
    "input_json" JSONB,
    "output_json" JSONB,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_playbooks" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "homefeed_tone_guidance" TEXT,
    "search_guidance" TEXT,
    "product_recommendations" TEXT[],
    "common_mistakes" TEXT[],
    "winning_patterns" TEXT[],

    CONSTRAINT "category_playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hq_briefing_date_idx" ON "hq_briefing"("date");

-- CreateIndex
CREATE INDEX "raw_items_source_id_collected_at_idx" ON "raw_items"("source_id", "collected_at");

-- CreateIndex
CREATE INDEX "opportunity_memos_status_created_at_idx" ON "opportunity_memos"("status", "created_at");

-- CreateIndex
CREATE INDEX "paperclip_decisions_decision_created_at_idx" ON "paperclip_decisions"("decision", "created_at");

-- CreateIndex
CREATE INDEX "topics_selected_at_idx" ON "topics"("selected_at");

-- CreateIndex
CREATE INDEX "keyword_clusters_opportunity_memo_id_idx" ON "keyword_clusters"("opportunity_memo_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_packages_topic_id_key" ON "content_packages"("topic_id");

-- CreateIndex
CREATE INDEX "content_packages_status_updated_at_idx" ON "content_packages"("status", "updated_at");

-- CreateIndex
CREATE INDEX "drafts_content_package_id_channel_idx" ON "drafts"("content_package_id", "channel");

-- CreateIndex
CREATE INDEX "sns_variants_content_package_id_platform_idx" ON "sns_variants"("content_package_id", "platform");

-- CreateIndex
CREATE INDEX "title_candidates_content_package_id_kind_idx" ON "title_candidates"("content_package_id", "kind");

-- CreateIndex
CREATE INDEX "exports_content_package_id_created_at_idx" ON "exports"("content_package_id", "created_at");

-- CreateIndex
CREATE INDEX "exports_draft_id_created_at_idx" ON "exports"("draft_id", "created_at");

-- CreateIndex
CREATE INDEX "exports_compliance_check_id_created_at_idx" ON "exports"("compliance_check_id", "created_at");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "products"("created_at");

-- CreateIndex
CREATE INDEX "shopping_connect_links_product_id_content_package_id_idx" ON "shopping_connect_links"("product_id", "content_package_id");

-- CreateIndex
CREATE INDEX "compliance_checks_content_package_id_pass_idx" ON "compliance_checks"("content_package_id", "pass");

-- CreateIndex
CREATE INDEX "status_transitions_content_package_id_created_at_idx" ON "status_transitions"("content_package_id", "created_at");

-- CreateIndex
CREATE INDEX "performance_logs_content_package_id_platform_idx" ON "performance_logs"("content_package_id", "platform");

-- CreateIndex
CREATE INDEX "revenue_logs_product_id_ordered_at_idx" ON "revenue_logs"("product_id", "ordered_at");

-- CreateIndex
CREATE INDEX "cost_logs_model_created_at_idx" ON "cost_logs"("model", "created_at");

-- CreateIndex
CREATE INDEX "cost_logs_pipeline_step_created_at_idx" ON "cost_logs"("pipeline_step", "created_at");

-- CreateIndex
CREATE INDEX "error_logs_severity_created_at_idx" ON "error_logs"("severity", "created_at");

-- CreateIndex
CREATE INDEX "company_memory_pattern_type_category_idx" ON "company_memory"("pattern_type", "category");

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_trigger_execution_id_key" ON "agent_runs"("trigger_execution_id");

-- CreateIndex
CREATE INDEX "agent_runs_agent_name_status_created_at_idx" ON "agent_runs"("agent_name", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_rules_rule_type_rule_code_key" ON "policy_rules"("rule_type", "rule_code");

-- AddForeignKey
ALTER TABLE "company_profile" ADD CONSTRAINT "company_profile_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_items" ADD CONSTRAINT "raw_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paperclip_decisions" ADD CONSTRAINT "paperclip_decisions_opportunity_memo_id_fkey" FOREIGN KEY ("opportunity_memo_id") REFERENCES "opportunity_memos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_paperclip_decision_id_fkey" FOREIGN KEY ("paperclip_decision_id") REFERENCES "paperclip_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_clusters" ADD CONSTRAINT "keyword_clusters_opportunity_memo_id_fkey" FOREIGN KEY ("opportunity_memo_id") REFERENCES "opportunity_memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_packages" ADD CONSTRAINT "content_packages_paperclip_decision_id_fkey" FOREIGN KEY ("paperclip_decision_id") REFERENCES "paperclip_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_packages" ADD CONSTRAINT "content_packages_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sns_variants" ADD CONSTRAINT "sns_variants_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_candidates" ADD CONSTRAINT "title_candidates_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_compliance_check_id_fkey" FOREIGN KEY ("compliance_check_id") REFERENCES "compliance_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_connect_links" ADD CONSTRAINT "shopping_connect_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_connect_links" ADD CONSTRAINT "shopping_connect_links_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_issues" ADD CONSTRAINT "compliance_issues_compliance_check_id_fkey" FOREIGN KEY ("compliance_check_id") REFERENCES "compliance_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_logs" ADD CONSTRAINT "performance_logs_content_package_id_fkey" FOREIGN KEY ("content_package_id") REFERENCES "content_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
