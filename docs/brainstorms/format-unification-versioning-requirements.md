---
date: 2026-04-24
topic: format-unification-versioning
---

# Format Unification & Versioning

## Problem Frame

The tutorial pipeline uses three different serialization formats (JSONL, JSON, YAML) across four data layers, with a redundant export step from compositions to YAML tutorials. No format carries a version field, making future migrations risky — there's no way to distinguish old-format files from new ones programmatically.

This consolidates the pipeline to two formats (JSONL for event streams, JSON for structured documents) and adds `formatVersion` fields to all layers so migrations can be handled safely going forward.

---

## Requirements

**Format consolidation**

- R1. Compositions become the canonical tutorial format. The renderer resolves `composition.json` at load time instead of reading pre-exported YAML round files.
- R2. The two existing YAML-based tutorials (`install-claude-code`, `nuclei-segmentation`) are migrated to `composition.json` files via a one-time migration script.
- R3. After migration, the YAML tutorial loader (`round-NN.yaml` globbing) and YAML export step are removed.
- R4. The `meta.yaml` fields (`slug`, `title`, `tags`, `thumbnail`, `sessions`, `welcome`, `briefing`, `author`) are absorbed into `TutorialComposition.meta` — no separate metadata file.
- R5. The static site build resolves compositions at build time, producing the same rendered output as today.

**Versioning**

- R6. `TutorialComposition` gains a `formatVersion: string` field (semver, initial value `"1.0.0"`).
- R7. `TraceState` gains a `formatVersion: string` field (initial `"1.0.0"`).
- R8. Imported session JSONL files gain a first-line header event: `{"type": "header", "formatVersion": "1.0.0", "importDate": "<ISO timestamp>"}`. Additional metadata fields (e.g., source session ID, import script version) can be included as useful.
- R9. Loaders for all three formats validate `formatVersion` on read and warn or error on unknown versions.

**Migration support**

- R10. A one-time migration script converts `meta.yaml` + `tutorial/round-NN.yaml` + `full-log/round-NN.yaml` into a `composition.json` for each existing tutorial.
- R11. Existing imported session JSONL files are backfilled with the header line (prepended, not appended).

---

## Success Criteria

- After migration, `npm run build` produces the same static site with all tutorials rendering correctly.
- Every data file in the pipeline (`src/sessions/`, `src/traces/`, `src/tutorials/`) carries a parseable `formatVersion`.
- Adding a new tutorial requires only a `composition.json` — no YAML files.

---

## Scope Boundaries

- No changes to the asset system (paths, rewriting, upload endpoints)
- No changes to the curation tool (`/curate/<slug>`) beyond adding `formatVersion` to trace output
- No changes to the session import filter logic (only the output gains a header line)
- i18n handling unchanged — `{ en, ja? }` objects stay as-is inside JSON
- The compose UI (`/compose/<slug>`) may need minor updates to write `formatVersion` but its core UX is unchanged
- YAML round files for the two existing tutorials are deleted after migration is verified

---

## Key Decisions

- **JSONL + JSON, not a single format**: JSONL fits append-only event streams (sessions); JSON fits structured documents (traces, compositions). Forcing everything into one format would lose the natural fit of each.
- **First-line header for session versioning**: Keeps JSONL self-contained without needing a sidecar file. Loaders skip or parse the header line.
- **Compositions replace tutorials directly**: No intermediate format. The composition *is* the tutorial — the renderer resolves trace references at build/load time.
- **Semver for formatVersion**: Allows minor/patch bumps for additive changes, major bumps for breaking changes. Starting at `1.0.0`.

---

## Dependencies / Assumptions

- The composition resolver (`src/lib/compose/resolve.ts`) already handles trace loading and asset rewriting — it needs to become the primary tutorial loader, not just a dev-tool helper.
- `TutorialComposition` already contains `meta`, `welcome`, `description`, `briefing` — it covers all fields currently in `meta.yaml`.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] How should the static adapter's `entries()` function discover tutorials — glob for `composition.json` files, or a registry?
- [Affects R5][Technical] Should composition resolution happen at build time (prerender) or client-side? Build time is safer for static hosting.
- [Affects R10][Technical] Should the migration script also generate `fullRounds` from `full-log/round-NN.yaml`, or are those handled differently in the composition model?
- [Affects R8][Needs research] What additional metadata is worth including in the session header line beyond `formatVersion` and `importDate`?

---

## Next Steps

-> `/ce-plan` for structured implementation planning
