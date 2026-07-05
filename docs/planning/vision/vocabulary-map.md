# 어휘 매핑: Company OS v0.7 ↔ Studio v2

> v2 마이그레이션 비용 절감용. v0.7 코드/문서 작성 시 이 표의 v0.7 열이 정본.
> v2 재기획 시 rename 마이그레이션의 출발점.

## 엔티티

| v0.7 (현행 정본) | Studio v2 | 관계 |
|---|---|---|
| `company_profile` | `workspaces` + workspace 설정 | 1:1 → workspace 루트로 승격 |
| `hq_briefing` | `daily_plan` (paperclip/daily-plan) | 동일 개념 |
| `sources` | `sources` | 동일 (v2에서 RSS/URL 타입 추가) |
| `raw_items` | `raw_items` + `source_snapshots` | v2에서 스냅샷 분리 |
| `opportunity_memos` | `briefs` | 동일 개념, 이름 변경 |
| (opportunity_memo 4축 점수 내장) | `brief_scores` | v2에서 별도 테이블 분리 |
| `paperclip_decisions` | `content_jobs` 생성 결정 | decision→job 생성으로 흡수 |
| `content_packages` | `content_jobs` | 동일 개념 (칸반 카드 단위) |
| `drafts` | `drafts` + `draft_variants` + `content_versions` | v2에서 A/B·버전 분리 |
| `sns_variants` | 채널별 `drafts` (channel 필드) | v2는 채널을 1급 축으로 |
| `title_candidates` | `draft_variants` (hook A/B) | 흡수 |
| `exports` | `publishing_queue` | export→발행 대기열로 일반화 |
| `shopping_connect_links` | `affiliate_links` | 쿠팡/무신사 등으로 일반화 |
| `compliance_checks` / `compliance_issues` | 동일 | 유지 |
| `status_transitions` | `approval_events` (승인 부분) | v0.7이 더 일반적 — v2에 역수출 권장 |
| `performance_logs` | `performance_logs` + `link_events` | v2에서 클릭 추적 분리 |
| `company_memory` | Analytics Agent 학습 저장소 | 동일 개념 |
| `prompt_templates` / `agent_runs` / `cost_logs` / `error_logs` | 동일 | 유지 (v2: `agent_configs`, `api_credentials`, `media_assets`, `dead_letter_jobs` 추가) |

## 상태값

| v0.7 PackageStatus (29상태, types.yaml §10 정본) | Studio v2 (23상태) |
|---|---|
| opportunity_found | collected/normalized/deduplicated/brief_created |
| paperclip_review | scored |
| selected → assigned | draft_requested |
| (생성 단계 상태들) | draft_generated → geo_optimized |
| compliance_checked | compliance_checked |
| owner_approval_required | needs_human_review |
| approved | approved |
| exported | published (v2는 API 발행 포함 → scheduled 추가) |
| on_hold / rejected / archived | (동일) + duplicate/failed/publish_failed 추가 |
| stale (7일) | stale + needs_source_refresh (신선도 소스별 차등) |

## 역할/모듈

| v0.7 | Studio v2 |
|---|---|
| Hermes (네이버 스캔) | Hermes Research Collector (멀티소스) |
| Paperclip HQ | Paperclip Orchestrator |
| Master Content Engine (P3-R1) | NaverBlogAgent + GEO Engine 분리 |
| Compliance Gate | Compliance Agent |
| Export Bundle | Publisher / Exporter (PublisherAdapter) |
| Performance Logger + Company Memory | Analytics Agent |
