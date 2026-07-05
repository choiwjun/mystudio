# Paperclip Company OS Design System

## 1. Atmosphere & Identity

Paperclip Company OS feels like a quiet operating room for a one-person media commerce company: dense enough for daily decisions, restrained enough to keep the owner moving. The signature is a dark command surface with precise violet focus states and compact Korean-first data cards.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|---|---|---|---|---|
| Surface/base | `--surface-base` | `#f7f8f8` | `#08090a` | Page background |
| Surface/panel | `--surface-panel` | `#ffffff` | `#0f1011` | Sidebar and persistent panels |
| Surface/card | `--surface-card` | `#ffffff` | `#191a1b` | Cards and grouped content |
| Surface/raised | `--surface-raised` | `#f3f4f5` | `#28282c` | Hover and raised controls |
| Text/primary | `--text-primary` | `#111318` | `#f7f8f8` | Primary UI text |
| Text/secondary | `--text-secondary` | `#4b5563` | `#d0d6e0` | Body and support text |
| Text/muted | `--text-muted` | `#6b7280` | `#8a8f98` | Captions and timestamps |
| Border/subtle | `--border-subtle` | `#e5e7eb` | `rgba(255,255,255,0.05)` | Soft dividers |
| Border/default | `--border-default` | `#d1d5db` | `rgba(255,255,255,0.08)` | Cards and inputs |
| Accent/primary | `--accent-primary` | `#4f46e5` | `#7170ff` | Main CTA and active nav |
| Accent/hover | `--accent-hover` | `#4338ca` | `#828fff` | Hover and focus |
| Status/success | `--status-success` | `#16a34a` | `#27a644` | Good state |
| Status/warning | `--status-warning` | `#d97706` | `#f59e0b` | Warning state |
| Status/error | `--status-error` | `#dc2626` | `#ef4444` | Risk and destructive |
| Status/info | `--status-info` | `#2563eb` | `#5e6ad2` | Informational badges |

### Rules

Accent color is only for action, active state, or focus. Status colors are semantic and never decorative. Raw color values belong only in token declarations.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---:|---:|---:|---:|---|
| H1 | 32px | 590 | 1.15 | 0 | Page title |
| H2 | 24px | 590 | 1.25 | 0 | Section title |
| H3 | 18px | 590 | 1.35 | 0 | Card title |
| Body | 15px | 400 | 1.6 | 0 | Default Korean body |
| Body/sm | 14px | 400 | 1.5 | 0 | Secondary info |
| Caption | 12px | 510 | 1.4 | 0 | Labels and metadata |
| Mono | 13px | 400 | 1.5 | 0 | IDs and technical labels |

### Font Stack

Primary: `Inter Variable`, `SF Pro Display`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `system-ui`, sans-serif. Mono: `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
|---|---:|---|
| `--space-1` | 4px | Icon gap |
| `--space-2` | 8px | Compact lists |
| `--space-3` | 12px | Form padding |
| `--space-4` | 16px | Card inner spacing |
| `--space-5` | 20px | Panel padding |
| `--space-6` | 24px | Section gap |
| `--space-8` | 32px | Major grid gap |

### Grid

Max content width is 1440px. Desktop uses sidebar plus two-column command layout. Tablet collapses the right rail below the main rail. Mobile uses one column with collapsible navigation.

## 5. Components

### App Shell

- **Structure**: fixed header, left department sidebar, main content area.
- **Variants**: desktop expanded, mobile stacked.
- **Spacing**: `--space-4`, `--space-5`, `--space-6`.
- **States**: active nav, hover nav, focus visible.
- **Accessibility**: semantic `header`, `nav`, `main`; current route uses `aria-current`.
- **Motion**: opacity and background color transitions only.

### Button

- **Structure**: native `button` or `a` with icon slot and label.
- **Variants**: primary, secondary, danger, ghost.
- **Spacing**: height 36px, horizontal padding `--space-4`.
- **States**: default, hover, active, focus, disabled, loading.
- **Accessibility**: visible focus outline, disabled attribute when unavailable.
- **Motion**: 120ms color and transform.

### Card

- **Structure**: section/article with header, body, footer slots.
- **Variants**: standard, alert, metric.
- **Spacing**: `--space-5` inner padding.
- **States**: default, hover for clickable cards, empty.
- **Accessibility**: heading hierarchy preserved.
- **Motion**: hover uses subtle translate only when clickable.

### Badge

- **Structure**: inline status label.
- **Variants**: neutral, success, warning, error, info.
- **Spacing**: `--space-2` horizontal padding.
- **States**: default only unless interactive filter.
- **Accessibility**: status text is explicit; color is not the only signal.
- **Motion**: none.

### Tabs

- **Structure**: compact horizontal tablist above the active work surface.
- **Variants**: data view filters, detail preview/compliance/edit modes.
- **Spacing**: 36px minimum control height with `--space-2` gaps.
- **States**: selected, hover, focus, disabled when a mode is unavailable.
- **Accessibility**: native buttons with `role="tablist"` on the group and `aria-selected`.
- **Motion**: color/background changes only.

### Data Table

- **Structure**: dense bordered table for products, links, and reviewable records.
- **Variants**: sortable list, stale-only filtered list, read-only audit table.
- **Spacing**: `--space-3` cell padding with no oversized row treatments.
- **States**: empty, stale, selected, loading.
- **Accessibility**: semantic table elements and explicit column labels.
- **Motion**: none.

### Detail Workspace

- **Structure**: three-column command layout: source rail, active work panel, action rail.
- **Variants**: content package detail with preview, compliance, and Markdown editing.
- **Spacing**: `--space-5` grid gaps and `--space-4` panel gaps.
- **States**: loading, demo fallback, autosave pending, saved, blocked export.
- **Accessibility**: side panels use labels, editor has an explicit textarea label, blocked actions use disabled buttons plus copy.
- **Motion**: none beyond existing button micro-interactions.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 120ms | ease-out | Button and nav press |
| Standard | 200ms | ease-in-out | Panel reveal |

Only animate `transform` and `opacity`. Respect `prefers-reduced-motion`.

## 7. Depth & Surface

Strategy: mixed. Panels use subtle borders; interactive cards add a small shadow only on hover. Nested cards are avoided.
