# Shared Assets Library

**Date:** 2026-04-23
**Status:** Approved

## Problem

Assets (images, videos) are stored per-tutorial at `static/tutorials/<slug>/assets/`. There is no way to reuse assets across tutorials without duplicating files, and no browsable inventory exists for discovering available assets.

## Design

### Storage & URL scheme

| Location | Served at | Scope |
|----------|-----------|-------|
| `static/assets/<filename>` | `/assets/<filename>` | Shared across all tutorials |
| `static/tutorials/<slug>/assets/<filename>` | `/tutorials/<slug>/assets/<filename>` | Per-tutorial (existing) |

Shared storage is flat (no subdirectories initially).

### Asset reference convention

In YAML and composition data, asset references use a prefix convention:

| Reference | Type | Resolved path |
|-----------|------|---------------|
| `step_001.png` | Per-tutorial (bare filename) | `tutorials/<slug>/assets/step_001.png` |
| `shared/fiji-logo.png` | Shared | `assets/fiji-logo.png` |
| `some/path/file.png` | Pass-through (contains `/`, not `shared/`) | `some/path/file.png` |
| `https://example.com/img.png` | Pass-through (URL) | `https://example.com/img.png` |

### `rewriteAssetPath()` changes

The function in `src/lib/compose/resolve.ts` gains shared-prefix handling:

```typescript
function rewriteAssetPath(slug: string, ref: string | undefined): string | undefined {
  if (!ref) return ref;
  if (ref.startsWith('shared/')) return `assets/${ref.slice(7)}`;
  if (ref.includes('/') || ref.includes('://')) return ref;
  return `tutorials/${slug}/assets/${ref}`;
}
```

The same logic is applied in the trace preview endpoint's inline rewriter (`src/routes/api/traces/[slug]/preview/+server.ts`).

### Upload endpoints

**Existing endpoint modified:** `POST /api/compose/[slug]/upload`

Gains an optional `target` FormData field:
- `target=tutorial` (default) — writes to `static/tutorials/<slug>/assets/`, returns `{ filename: "name" }`
- `target=shared` — writes to `static/assets/`, returns `{ filename: "shared/name" }`

The `filename` in the response is the YAML-ready reference (bare or `shared/`-prefixed).

**New endpoint:** `POST /api/assets/upload`

Standalone shared upload (no slug context needed). Accepts multipart FormData with `file` and optional `filename`. Writes to `static/assets/`. Returns `{ ok: true, filename: "shared/<name>", path: "assets/<name>" }`.

Both endpoints are dev-only (`prerender = false`).

### Asset listing endpoint

**New endpoint:** `GET /api/assets`

Globs `static/assets/*` and `static/tutorials/*/assets/*`, returns:

```json
{
  "shared": ["fiji-logo.png", "arrow.svg"],
  "tutorials": {
    "blob-segmentation": ["step_001.png", "step_002.png"],
    "nuclei-segmentation": ["nuclei.png"]
  }
}
```

Dev-only (`prerender = false`).

### Asset panel on `/edit` dashboard

A fourth section added to the edit dashboard (`src/routes/edit/+page.svelte`):

- **"Shared Assets"** group at top, expanded by default
  - Flex grid of thumbnail icons (multiple per row, flex-wrap)
  - Each shows a small thumbnail + filename
  - Upload button in the section header → file input → `POST /api/assets/upload`
- **Per-tutorial groups** below, collapsed by default
  - Same flex grid layout when expanded
- **Click any asset** → copies YAML-ready reference to clipboard (`step_001.png` or `shared/fiji-logo.png`)
  - Brief toast/status confirmation

Visual style matches existing aubergine + orange dark theme with frosted-glass panels.

### Preview & export resolution

Both `resolveComposition()` (compose pipeline) and the trace preview endpoint apply the updated `rewriteAssetPath()` with `shared/` prefix handling. The function is defined once in `src/lib/compose/resolve.ts` and imported where needed.

## Files to create or modify

| File | Action |
|------|--------|
| `static/assets/` | Create directory |
| `src/lib/compose/resolve.ts` | Add `shared/` prefix handling to `rewriteAssetPath()` |
| `src/routes/api/traces/[slug]/preview/+server.ts` | Import and use shared `rewriteAssetPath()` |
| `src/routes/api/assets/+server.ts` | New: listing endpoint (`GET`) |
| `src/routes/api/assets/upload/+server.ts` | New: shared upload endpoint (`POST`) |
| `src/routes/api/compose/[slug]/upload/+server.ts` | Add `target` field support |
| `src/routes/edit/+page.svelte` | Add assets panel section |
| `src/routes/edit/+page.ts` (or `+page.server.ts`) | Fetch asset listing data |

## Out of scope

- Asset picker drawer in `/compose` (future enhancement)
- Subdirectory organization within `static/assets/`
- Asset metadata or tagging
- Asset deletion from the UI
