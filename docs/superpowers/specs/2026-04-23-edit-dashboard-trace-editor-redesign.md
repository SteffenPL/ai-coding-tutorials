# Edit Dashboard & Trace Editor Redesign

**Date**: 2026-04-23  
**Scope**: Edit overview layout, unified trace editor, composition search, author metadata

---

## 1. Edit Overview Layout

**Current**: Five vertical collapsible sections (Sessions, Traces, Tutorials, Assets, Trash).

**New layout**:

```
┌─────────────────┬─────────────────┐
│    Sessions     │     Traces      │
│   (scrollable)  │  (scrollable)   │
├─────────────────┴─────────────────┤
│            Tutorials              │
├───────────────────────────────────┤
│              Assets               │
├───────────────────────────────────┤
│         Trash (collapsed)         │
└───────────────────────────────────┘
```

- Top row: CSS grid `grid-template-columns: 1fr 1fr`. Sessions left, Traces right. Each panel is independently scrollable with a max-height.
- Tutorials spans full width below.
- Assets spans full width below tutorials.
- Trash remains a collapsible section at the bottom.
- On mobile (<=768px): stack all panels vertically (single column).

## 2. Unified Trace Editor

**Current**: Two-panel layout — source panel (read-only session) on the left, curated panel (editable trace) on the right. User toggles `included` checkboxes in source, edits in curated.

**New**: Single-panel editor showing the trace as one ordered list. Each element is the trace step itself, with inline controls.

### Step rendering

Each step renders as a row:

- **Included steps**: Rendered normally (current curated panel style). Inline edit controls: display mode toggle, comment indicator, move up/down, edit (opens drawer), remove.
- **Excluded steps**: Grayed out, collapsed to a single line showing step type icon + truncated label. Click to expand/re-include.
- **Per-element reset button**: Shown as a small ↺ icon next to steps that have a `sourceRef`. Clicking resets overrides, comment, displayMode, and shortenedText back to the source session's original values. Steps without `sourceRef` (inserted manually) don't show this button.

### Round headers

Each round header shows:
- Kind badge (claude/terminal)
- Editable prompt
- Source indicator (if `sourceRoundIndex` exists): "from session R{n}"
- Round-level reset button (resets prompt + all steps with sourceRef)
- Remove round button

### Toolbar

- **Reset all** button (existing) — resets entire trace to session source
- **Insert round** — dropdown at any position
- **Insert step** — dropdown within any round, between steps
- **Toggle excluded visibility** — show/hide grayed-out excluded steps (default: show)

### Data model

No changes to `TraceState`, `TraceStep`, or `TraceRound`. The `included` field already controls visibility. The `sourceRef` field already tracks which steps have a source. Reset logic reads from the session data (already loaded).

## 3. Composition Block Search Bar

**Current**: "Add block" buttons open a trace picker that lists trace slugs. Click to add entire trace.

**New**: A search bar input that appears when clicking "Add block" (or at the top of the block list). Typing filters results in a dropdown.

### Search index

Items searchable:
- **Traces** (whole): `{slug}` — adds a `TraceBlock` with all rounds
- **Trace rounds**: `{traceSlug} → Round {n}: {prompt snippet}` — adds a `TraceBlock` with `rounds: [n]`

### Result display

Grouped dropdown:
```
─── trace: fiji-segmentation ───
  ⬡ Full trace (4 rounds)
  R1: "Install the MCP server..."
  R2: "Open the sample image..."
  R3: ...
─── trace: matrix-rain ───
  ⬡ Full trace (3 rounds)
  R1: ...
```

Selecting a full trace adds `{ kind: 'trace', sourceSlug }`. Selecting a round adds `{ kind: 'trace', sourceSlug, rounds: [index] }`.

### Interaction

- Search input with debounced filter (local, no API call — traces are already loaded on the compose page)
- Results appear in a positioned dropdown below the input
- Click or Enter to add the selected item
- Esc or blur to close
- Insert position: at the cursor / at the end of block list

## 4. Author Metadata

### Type changes

In `TutorialMeta` (`src/lib/data/tutorials.ts`):
```ts
export interface TutorialMeta {
  slug: string;
  title: { en: string; ja?: string };
  tags: string[];
  thumbnail?: string;
  sessions?: SessionRef[];
  author: string;  // NEW — required, default "Steffen Plunder"
}
```

### Where author appears

- **Tutorial viewer** (`TutorialViewer.svelte`): Show author in the welcome overlay below the title, styled subtly (smaller font, muted color). Format: `"by {author}"`.
- **Tutorial cards** (index page): Show author below title if present.
- **Compose editor**: Author text input in the metadata section. Pre-filled with "Steffen Plunder" for new tutorials.
- **YAML export**: Include `author` in `meta.yaml`.

### Migration

Existing tutorials without `author` get the default at load time. The field is required in the type but the loader fills `"Steffen Plunder"` if absent from YAML.

---

## Files to modify

| Area | Files |
|------|-------|
| Edit overview | `src/routes/edit/+page.svelte` |
| Trace editor | `src/routes/curate/[slug]/+page.svelte`, `src/lib/curate/components/SourcePanel.svelte` (remove), `CuratedPanel.svelte` (merge into unified), `EditDrawer.svelte` (keep) |
| Composition search | `src/routes/compose/[slug]/+page.svelte`, new `BlockSearchBar.svelte` component |
| Author metadata | `src/lib/data/tutorials.ts`, `src/lib/compose/types.ts`, `TutorialViewer.svelte`, tutorial card component, compose page, YAML export/import |
