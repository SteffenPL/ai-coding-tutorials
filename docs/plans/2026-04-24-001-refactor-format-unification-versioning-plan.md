---
title: "refactor: Unify data formats (JSON compositions replace YAML tutorials) and add formatVersion"
type: refactor
status: active
date: 2026-04-24
origin: docs/brainstorms/format-unification-versioning-requirements.md
---

# Unify Data Formats & Add Versioning

## Overview

Replace YAML-based tutorial files with JSON compositions as the canonical tutorial format, and add `formatVersion` fields to all three data layers (sessions, traces, compositions). After this change the pipeline uses exactly two formats: JSONL for event streams, JSON for structured documents.

---

## Problem Frame

The tutorial pipeline uses three serialization formats across four layers, with a redundant YAML export step. No format carries a version field, making future migrations risky. (see origin: `docs/brainstorms/format-unification-versioning-requirements.md`)

---

## Requirements Trace

- R1. Compositions become the canonical tutorial format
- R2. Existing YAML tutorials migrated to `composition.json`
- R3. YAML tutorial loader and export step removed
- R4. `meta.yaml` fields absorbed into `TutorialComposition.meta`
- R5. Static site build resolves compositions at build time
- R6. `TutorialComposition` gains `formatVersion`
- R7. `TraceState` gains `formatVersion`
- R8. Session JSONL gains first-line header event
- R9. Loaders validate `formatVersion` on read
- R10. Migration script for existing tutorials
- R11. Session JSONL backfill with header line

---

## Scope Boundaries

- No changes to the asset system (paths, rewriting, upload endpoints)
- No changes to the curation tool beyond adding `formatVersion` to trace output
- No changes to session import filter logic (only output gains a header line)
- i18n handling unchanged
- Compose UI (`/compose/<slug>`) gets minor updates to write `formatVersion`
- YAML files deleted after migration is verified

### Deferred to Follow-Up Work

- Removing the legacy session path (`src/tutorials/*/session/`) from the session loader — separate cleanup
- Updating the compose UI to support `fullBlocks` editing — compositions currently have no UI for full-log blocks

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/data/tutorial-loader.ts` — current YAML-glob loader. Uses `import.meta.glob` with `eager: true` + `?raw` for synchronous build-time loading. This pattern will be reused for JSON compositions.
- `src/lib/compose/resolve.ts` — `resolveComposition()` already converts `TutorialComposition` → `Tutorial`. Handles trace loading, asset rewriting, welcome conversion. This becomes the primary loader.
- `src/lib/compose/types.ts` — `TutorialComposition` type. Already has `meta`, `welcome`, `description`, `briefing`, `blocks`.
- `src/lib/trace/types.ts` — `TraceState` type. No version field yet.
- `src/lib/session/schema.ts` — Zod schema with `type` discriminator. Header event needs a new discriminant.
- `src/routes/tutorials/[slug]/+page.ts` — `entries()` and `load()` for static prerender.
- `scripts/import-session.ts` — `filterJsonl()` produces output lines. Header line prepended here.

### Existing Data Inventory

| Slug | tutorial/ rounds | full-log/ rounds | Trace exists | Session exists |
|------|-----------------|-----------------|--------------|----------------|
| `install-claude-code` | 3 (02-04) | 4 (01-04) | Yes (`src/traces/install-claude-code/`) | Yes (in `src/tutorials/` legacy path) |
| `nuclei-segmentation` | 2 (01-02) | 2 (01-02) | Yes (`src/traces/Nuclei Segmentation/` — note: space + capitals, mismatches slug) | Yes (in `src/sessions/Nuclei Segmentation/`) |

**Note:** The trace directory `src/traces/Nuclei Segmentation/` uses a different naming convention than the tutorial slug `nuclei-segmentation`. The migration script (U4) should rename the trace directory to match the slug, or the composition's `TraceBlock.sourceSlug` must use the exact directory name. Renaming is preferred for consistency.

---

## Key Technical Decisions

- **Composition globs replace YAML globs**: `import.meta.glob('/src/tutorials/*/composition.json', { eager: true, query: '?raw' })` replaces the three YAML globs. Resolution happens synchronously at module load, same as today.
- **`fullBlocks` added to `TutorialComposition`**: Parallel to `blocks`, this optional field holds the full-log version. Both tutorials have `full-log/` rounds that must be preserved. The migration script converts these to `HandAuthoredBlock[]`.
- **Trace loading at build time**: The composition resolver's `TraceLoader` callback uses the same `import.meta.glob` pattern for `src/traces/*/trace.json`. This is already synchronous — no async needed.
- **`rewriteContent` in resolve.ts gains `window-collection` case**: The tutorial-loader's `rewriteContent` handles `window-collection` recursively but the compose resolver's doesn't. Since all loading routes through the resolver after migration, add the `window-collection` case to `resolve.ts`'s `rewriteContent`. The tutorial-loader's version is deleted with the YAML loader (U9).
- **Session header uses existing Zod discriminator pattern**: Add `type: 'header'` as a new event type in the `SessionEvent` union. Loaders that don't understand it skip it; the session loader extracts metadata from it.

---

## Open Questions

### Resolved During Planning

- **How should `entries()` discover tutorials?** Glob for `composition.json` files — same eager glob pattern as current YAML loader.
- **Build time or client-side resolution?** Build time. The `import.meta.glob` eager pattern keeps everything synchronous and statically analyzable.
- **How to handle `fullRounds`?** Add `fullBlocks?: CompositionBlock[]` to `TutorialComposition`. Migration script converts `full-log/round-NN.yaml` into `HandAuthoredBlock[]`. Extend `resolveComposition()` to accept and process `fullBlocks` in the same pass — the function resolves `blocks` → `rounds` and `fullBlocks` → `fullRounds` on the returned `Tutorial`, not by calling itself twice.
- **Session header metadata?** `formatVersion`, `importDate` (ISO), `sourceSessionId` (original filename without extension).

### Deferred to Implementation

- Exact Zod schema shape for the header event — will be determined when implementing
- Whether `devOnly` flag should move into `TutorialComposition.meta` or stay as a top-level field — either way, the tutorial-loader must check it consistently
- Whether to rename `src/traces/Nuclei Segmentation/` to `src/traces/nuclei-segmentation/` for slug consistency — preferred but may affect the curation tool's saved references

---

## Implementation Units

- [ ] U1. **Add `formatVersion` to type definitions**

**Goal:** Add `formatVersion` field to `TutorialComposition`, `TraceState`, and create the session header event type.

**Requirements:** R6, R7, R8

**Dependencies:** None

**Files:**
- Modify: `src/lib/compose/types.ts`
- Modify: `src/lib/trace/types.ts`
- Modify: `src/lib/session/schema.ts`

**Approach:**
- Add `formatVersion: string` to `TutorialComposition` interface
- Add `fullBlocks?: CompositionBlock[]` to `TutorialComposition` (needed for full-log support)
- Add `formatVersion: string` to `TraceState` interface
- Add a `HeaderEvent` with `type: 'header'` to the session schema's Zod union. Fields: `formatVersion`, `importDate`, `sourceSessionId`
- Export a `FORMAT_VERSION = '1.0.0'` constant from a shared location

**Patterns to follow:**
- Existing `SessionEvent` Zod union pattern in `src/lib/session/schema.ts`
- Existing `TutorialComposition` interface in `src/lib/compose/types.ts`

**Test scenarios:**
- Test expectation: none — pure type/schema changes verified by TypeScript compilation and downstream unit usage

**Verification:**
- `npm run check` passes with no type errors
- All downstream code that reads these types sees the new fields

---

- [ ] U2. **Rewrite tutorial-loader to load compositions**

**Goal:** Replace the YAML-glob tutorial loader with one that globs `composition.json` files and resolves them at build time using the existing composition resolver.

**Requirements:** R1, R4, R5

**Dependencies:** U1

**Files:**
- Modify: `src/lib/data/tutorial-loader.ts`
- Modify: `src/lib/compose/resolve.ts`

**Approach:**
- Replace three YAML globs with two JSON globs: `*/composition.json` and `src/traces/*/trace.json`
- Build a `TraceLoader` from the trace glob results
- Call `resolveComposition()` for each composition, producing `Tutorial` objects
- Extend `resolveComposition()` to process `fullBlocks` in the same call — resolve them into `fullRounds` on the returned `Tutorial` using the same block-resolution logic as `blocks`
- Add the `window-collection` case to `resolve.ts`'s `rewriteContent` (recursively rewrite sub-window content), matching the pattern already in `tutorial-loader.ts` lines 91-97
- Preserve `devOnly` support (check it in composition meta or as a top-level field)
- Keep the same public API: `getAllTutorials()`, `getTutorialBySlug(slug)`

**Patterns to follow:**
- Current `import.meta.glob` eager pattern in `tutorial-loader.ts`
- `resolveComposition()` in `src/lib/compose/resolve.ts`

**Test scenarios:**
- Happy path: composition with trace blocks resolves to Tutorial with correct rounds and asset paths
- Happy path: composition with hand-authored blocks resolves correctly
- Happy path: composition with `fullBlocks` produces `fullRounds` on the Tutorial
- Edge case: composition referencing a non-existent trace slug skips that block gracefully
- Edge case: composition with `devOnly: true` filtered out in production build

**Verification:**
- `npm run build` succeeds
- Built site renders both tutorials identically to current output
- `entries()` still discovers both tutorials

---

- [ ] U3. **Add version validation to loaders**

**Goal:** Loaders for all three formats validate `formatVersion` on read and warn on unknown versions.

**Requirements:** R9

**Dependencies:** U1, U2

**Files:**
- Modify: `src/lib/data/tutorial-loader.ts`
- Modify: `src/lib/session/loader.ts`
- Modify: `src/lib/compose/resolve.ts` (or the trace loading path)

**Approach:**
- Composition loader: check `formatVersion` after parsing JSON. Warn to console if missing or unrecognized. Accept `1.x.x` range.
- Trace loader: same pattern when loading `trace.json`
- Session loader: detect first-line header event, extract `formatVersion`. Warn if missing (pre-migration files) or unrecognized.
- Use `console.warn` not `throw` — graceful degradation for forward compatibility

**Patterns to follow:**
- Session loader's existing `safeParse` + console warn pattern for invalid lines

**Test scenarios:**
- Happy path: file with `formatVersion: "1.0.0"` loads without warnings
- Edge case: file missing `formatVersion` produces a console warning but still loads
- Edge case: file with `formatVersion: "2.0.0"` produces a warning about unknown version

**Verification:**
- All tutorials load correctly with `formatVersion: "1.0.0"` in their composition files
- Dev console shows no unexpected warnings during `npm run dev`

---

- [ ] U4. **Write migration script for existing tutorials**

**Goal:** One-time script that converts `meta.yaml` + `tutorial/round-NN.yaml` + `full-log/round-NN.yaml` into a `composition.json` for each existing tutorial.

**Requirements:** R2, R4, R10

**Dependencies:** U1

**Files:**
- Create: `scripts/migrate-yaml-to-composition.ts`

**Approach:**
- For each tutorial slug with a `meta.yaml`:
  - Parse `meta.yaml` → build `TutorialComposition.meta` + `welcome` + `briefing`
  - Parse `tutorial/round-NN.yaml` files → convert each to a `HandAuthoredBlock`
  - Parse `full-log/round-NN.yaml` files → convert each to a `HandAuthoredBlock` in `fullBlocks`
  - Set `formatVersion: "1.0.0"`
  - Write `composition.json` to the tutorial directory
- Provide `--dry-run` flag to preview without writing
- Report what was converted

**Patterns to follow:**
- `scripts/import-session.ts` CLI pattern (args parsing, dry-run, reporting)

**Test scenarios:**
- Happy path: `install-claude-code` produces a valid `composition.json` with 3 tutorial blocks and 4 full-log blocks
- Happy path: `nuclei-segmentation` produces a valid `composition.json` with 2 tutorial blocks and 2 full-log blocks
- Happy path: `--dry-run` prints report without writing files
- Integration: running the migration script then `npm run build` produces identical output

**Verification:**
- Generated `composition.json` files match the structure expected by the new loader
- `npm run build` succeeds after migration
- Visual comparison of rendered tutorials shows no differences

---

- [ ] U5. **Backfill session JSONL with header lines**

**Goal:** Prepend a header event to all existing imported session JSONL files.

**Requirements:** R8, R11

**Dependencies:** U1

**Files:**
- Create: `scripts/backfill-session-headers.ts`

**Approach:**
- Glob all `.jsonl` files in `src/sessions/` and `src/tutorials/*/session/`
- For each file: check if the first line is already a `type: "header"` event
- If not, prepend `{"type":"header","formatVersion":"1.0.0","importDate":"<now>","sourceSessionId":"<filename>"}`
- Also process subagent `.jsonl` files in subdirectories
- Provide `--dry-run` flag

**Patterns to follow:**
- `scripts/import-session.ts` file I/O pattern

**Test scenarios:**
- Happy path: JSONL file without header gets one prepended
- Edge case: JSONL file that already has a header is skipped
- Edge case: subagent JSONL files also get headers

**Verification:**
- Every `.jsonl` file in the project starts with a `type: "header"` line
- Session loader still reads all sessions correctly

---

- [ ] U6. **Update import script to emit header lines**

**Goal:** Modify the session import script so all future imports include the header event as the first line.

**Requirements:** R8

**Dependencies:** U1

**Files:**
- Modify: `scripts/import-session.ts`

**Approach:**
- After filtering, prepend the header event to `outLines` before writing
- Include `formatVersion`, `importDate` (current time), `sourceSessionId` (from the session filename)
- Same for subagent `.jsonl` files

**Patterns to follow:**
- Existing `filterJsonl` + `writeFileSync` pattern in the same file

**Test scenarios:**
- Happy path: newly imported session starts with a header line
- Happy path: header `importDate` reflects the actual import time
- Happy path: subagent files also start with headers

**Verification:**
- Import a test session and verify the first line is a valid header event

---

- [ ] U7. **Add `formatVersion` to trace save endpoints**

**Goal:** Ensure traces saved via the curation tool include `formatVersion`.

**Requirements:** R7

**Dependencies:** U1

**Files:**
- Modify: `src/routes/api/traces/[slug]/+server.ts`

**Approach:**
- When saving a `TraceState` via POST, ensure `formatVersion: "1.0.0"` is set if not already present
- When creating new traces, default to the current version

**Patterns to follow:**
- Existing POST handler in the trace API endpoint

**Test scenarios:**
- Happy path: saving a trace via the API includes `formatVersion` in the persisted JSON
- Edge case: saving a trace that already has `formatVersion` preserves it

**Verification:**
- Save a trace via `/curate/<slug>` and verify `trace.json` contains `formatVersion`

---

- [ ] U8. **Backfill existing traces with `formatVersion`**

**Goal:** Add `formatVersion: "1.0.0"` to the two existing `trace.json` files.

**Requirements:** R7

**Dependencies:** U1

**Files:**
- Modify: `src/traces/install-claude-code/trace.json`
- Modify: `src/traces/Nuclei Segmentation/trace.json` (directory name has space + capitals — consider renaming to `nuclei-segmentation/` for consistency)

**Approach:**
- Simple script or manual edit: read each `trace.json`, add `formatVersion: "1.0.0"`, write back
- Can be done as part of the migration script (U4) or as a standalone one-liner

**Test scenarios:**
- Test expectation: none — trivial JSON field addition, verified by loader validation (U3)

**Verification:**
- Both trace files contain `formatVersion: "1.0.0"`

---

- [ ] U9. **Clean up: remove YAML loader code and old files**

**Goal:** Remove the YAML tutorial loader, YAML export endpoint, and the migrated YAML files.

**Requirements:** R3

**Dependencies:** U2, U4 (migration must be verified first)

**Files:**
- Modify: `src/lib/data/tutorial-loader.ts` (remove any remaining YAML fallback)
- Delete: `src/tutorials/install-claude-code/meta.yaml`
- Delete: `src/tutorials/install-claude-code/tutorial/` (directory)
- Delete: `src/tutorials/install-claude-code/full-log/` (directory)
- Delete: `src/tutorials/nuclei-segmentation/meta.yaml`
- Delete: `src/tutorials/nuclei-segmentation/tutorial/` (directory)
- Delete: `src/tutorials/nuclei-segmentation/full-log/` (directory)
- Modify: `src/routes/api/compose/[slug]/export/+server.ts` (remove or mark deprecated)

**Approach:**
- Verify `npm run build` works with compositions only (U2 must be complete)
- Delete YAML files and directories
- Remove YAML-specific imports (`js-yaml` from tutorial-loader if no longer needed elsewhere)
- The YAML export endpoint can either be removed or kept as a dev convenience — user's call

**Test scenarios:**
- Happy path: `npm run build` succeeds after all YAML files are deleted
- Happy path: both tutorials render correctly from compositions only

**Verification:**
- No YAML tutorial files remain in `src/tutorials/`
- `npm run build` and `npm run dev` both work
- Site renders both tutorials correctly

---

## System-Wide Impact

- **Interaction graph:** The compose UI (`/compose/<slug>`) saves `composition.json` → the tutorial loader reads it. The curation tool saves `trace.json` → the composition resolver loads traces. The session import writes JSONL → the session loader reads it. All three paths gain version validation.
- **Error propagation:** Version mismatches produce `console.warn`, not errors. Forward-compatible: unknown minor/patch versions load normally; unknown major versions warn but still attempt to load.
- **State lifecycle risks:** The migration script (U4) and backfill script (U5) modify existing committed files. Run them, verify, commit the results. No runtime state concerns.
- **API surface parity:** The compose preview endpoint and export endpoint may need minor updates to handle `formatVersion` and `fullBlocks`, but their external interface doesn't change.
- **Unchanged invariants:** The `Tutorial` type consumed by `TutorialViewer` is unchanged. The viewer doesn't know or care whether data came from YAML or JSON compositions. Asset paths, window types, step types — all unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Migration produces subtly different output (whitespace, ordering) | Visual comparison of rendered tutorials before and after. Build output diffing. |
| `full-log/` rounds don't convert cleanly to composition blocks | Migration script validates round structure and reports errors |
| Removing YAML files before verifying compositions work | U9 depends on U2 and U4 being verified first. Don't delete until build passes. |
| `js-yaml` dependency still needed elsewhere after removal from tutorial-loader | Check all imports before removing the dependency from package.json |

---

## Sources & References

- **Origin document:** [docs/brainstorms/format-unification-versioning-requirements.md](docs/brainstorms/format-unification-versioning-requirements.md)
- Related code: `src/lib/data/tutorial-loader.ts`, `src/lib/compose/resolve.ts`, `src/lib/compose/types.ts`
- Related code: `src/lib/trace/types.ts`, `src/lib/session/schema.ts`
- Related code: `scripts/import-session.ts`
