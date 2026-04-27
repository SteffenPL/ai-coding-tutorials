---
title: "feat: Complete editor coverage for all content types and reduce view divergence"
type: feat
status: active
date: 2026-04-27
---

# Complete Editor Coverage and View Consistency

## Overview

The code review audit identified gaps in three areas: (1) the curate editor cannot insert or edit several supported content types (`permission`, `table`, `folder`, `window-collection`), (2) the source-step editor path is much sparser than the inserted-step path for window content, and (3) the slides view has unnecessary divergence from the desktop stacking algorithm and no mechanism to opt additional step types into the presentation. This plan addresses all three.

---

## Problem Frame

Tutorial authors currently hit dead ends when curating content: opening the editor for a session-sourced markdown window shows no text field, trying to insert a folder tree or permission step requires hand-editing JSON, and the slides view silently drops potentially useful steps (like key tool invocations) with no override. These gaps slow down the tutorial authoring workflow and create inconsistency between what the type system supports and what the UI can actually edit.

---

## Requirements Trace

- R1. Every step type in `StepType` must be insertable from the curate UI's insert menu
- R2. Every step type must have editor fields in `StepEditorModal` for both source-step and inserted-step paths
- R3. Every window content kind must have editor fields in both `editSourceStep` and `editInsertedStep` snippets
- R4. The slides window stacking algorithm should use the same parameters as the desktop `DesktopStack`
- R5. Tutorial authors should be able to opt specific non-default steps into the slides view via the existing `slideDuration` field

---

## Scope Boundaries

- No changes to the type system itself (`tutorials.ts`) — all types already exist
- No changes to the session → trace conversion pipeline — the gaps there are by design (most types are hand-authored)
- No new rendering components — all types already render correctly via `StepRenderer` and `WindowContent`
- No changes to the desktop or mobile tutorial viewer behavior
- `fullRounds` support in slides is deferred — it would require duplicating the simplified/full toggle infrastructure

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/curate/components/StepEditorModal.svelte` — the full-screen modal editor with two snippet paths: `editSourceStep` (session-sourced steps) and `editInsertedStep` (hand-authored steps)
- `src/lib/curate/components/UnifiedTracePanel.svelte:276-297` — insert menu with grouped buttons
- `src/routes/curate/[slug]/+page.svelte:178-193` — `insertWindowStep()` handler with `contentMap`
- `src/lib/components/tutorial/DesktopStack.svelte:53-73` — desktop `stackStyle()` function
- `src/lib/components/slides/SlidesPlayer.svelte:34-52` — slides scene model builder
- `src/lib/components/slides/SlidesPlayer.svelte:107-117` — slides `windowStackStyle()` function

### Institutional Learnings

- WYSIWYG trace editing pattern: `StepRenderer` is shared between editor and viewer, so visual changes in the editor preview are free
- The existing curate editor plan (`2026-04-23-001`) focused on inline editing and visual upgrades; this plan is complementary (editor field coverage, not UX improvements)

---

## Key Technical Decisions

- **Source-step window editing via `overrides.content`**: Source-step windows store their content in `overrides.content`. The editor should branch on `(overrides.content as Record<string, unknown>).kind` to expose text/language/statusBar fields, mirroring the `editInsertedStep` pattern. Edits mutate the overrides object directly (same as existing title editing).
- **`permission` and `table` as generic-field editors**: Rather than building specialized UIs (drag-and-drop table builder, etc.), these get straightforward text input fields for each property. This is sufficient for the tutorial authoring use case where these types are rare.
- **`folder` editor as JSON textarea**: The folder entry tree structure (`FolderEntry[]`) is recursive and complex enough that a tree editor would be a significant UI effort. A JSON textarea with validation is practical for the rare insertion case. A proper tree editor can follow later.
- **`window-collection` editor as sub-window list**: A simple list of sub-windows where each entry has title + content kind selector + kind-specific fields. Not a full grid layout editor — the `rows`/`cols` are set as number inputs.
- **Slides step opt-in via `slideDuration`**: Steps already have a `slideDuration?: number` field. The slides scene builder currently only checks step type. Adding a check for `slideDuration` being set on non-default types (thinking, tool_call, etc.) is a minimal change that gives authors an opt-in mechanism without adding a new field.
- **Unified stacking constants**: Extract the stacking parameters (tx multiplier, ty multiplier, scale decay, opacity decay, brightness decay) into a shared object imported by both `DesktopStack` and `SlidesPlayer`, eliminating the parameter divergence.

---

## Implementation Units

- [ ] U1. **Source-step window editor: add content-kind branching**

**Goal:** Make session-sourced window steps fully editable by adding content-kind-specific fields to the `editSourceStep` snippet, matching the `editInsertedStep` coverage.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/lib/curate/components/StepEditorModal.svelte`

**Approach:**
- In the `editSourceStep` snippet's `type === 'window'` branch (currently lines 335-360), add branching on `(content as Record<string, unknown>).kind`
- For `fiji-image`: add `statusBar` text input (same as inserted path, line 496-505)
- For `markdown`: add `text` textarea (same as inserted path, line 506-509)
- For `source`: add `text` textarea + `language` input (same as inserted path, line 511-519)
- For `folder`: add JSON textarea for `entries` (new, see U3)
- For `window-collection`: add sub-window list editor (new, see U4)
- Keep the existing `windowTitle` and asset picker (`src` fields) — they stay as-is
- Add `subtitle` text input (currently only in the inserted path, line 482)

**Patterns to follow:**
- The `editInsertedStep` window branch (lines 475-521) is the reference implementation
- Asset picker integration pattern: lines 484-494

**Test scenarios:**
- Happy path: Open editor for a session-sourced fiji-image window → statusBar field appears and is editable, preview updates on input
- Happy path: Open editor for a session-sourced markdown window → text textarea appears and is editable
- Happy path: Open editor for a session-sourced source window → text textarea + language input appear
- Edge case: Session-sourced window with unknown content kind → falls through gracefully (shows only title/subtitle)

**Verification:**
- Every window content kind shows its content-specific fields when editing a session-sourced step
- Live preview updates when content fields are modified

---

- [ ] U2. **Add `permission` and `table` to insert menu and editor**

**Goal:** Make `permission` and `table` step types insertable from the UI and editable in both editor paths.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/curate/components/UnifiedTracePanel.svelte`
- Modify: `src/lib/curate/components/StepEditorModal.svelte`
- Modify: `src/routes/curate/[slug]/+page.svelte`

**Approach:**
- **Insert menu** (UnifiedTracePanel): Add "Permission" and "Table" buttons to the insert menu. Permission in the primary group (alongside Question), Table in a new "Data" group or alongside Status.
- **Insert handler** (curate page): Add inline `insertStep` calls with default shapes:
  - Permission: `{ type: 'permission', tool: '', description: '', granted: true }`
  - Table: `{ type: 'table', columns: ['Column 1'], rows: [['Value']], moreRows: 0 }`
- **Editor — inserted path** (StepEditorModal `editInsertedStep`): Add branches for:
  - `permission`: text input for `tool`, textarea for `description`, checkbox for `granted`
  - `table`: text inputs for column headers (add/remove), textarea rows (one per line, tab-separated cells), number input for `moreRows`
- **Editor — source path** (StepEditorModal `editSourceStep`): Add matching branches reading from `overrides`

**Patterns to follow:**
- Question step editor (lines 287-334 for source, 422-469 for inserted) — similar structure of multiple related fields
- Status step editor (lines 408-421) for the variant/checkbox pattern

**Test scenarios:**
- Happy path: Click "Permission" in insert menu → new permission step appears with default values, opens in editor with all fields
- Happy path: Click "Table" in insert menu → new table step with one column and one row, editable
- Happy path: Add a column to table → preview updates with new column header
- Happy path: Edit a session-sourced permission step → tool, description, granted fields are editable
- Edge case: Table with zero rows → renders empty table body, no crash

**Verification:**
- Both types appear in insert menu and create valid steps
- Both types have complete editor fields in both source and inserted paths
- Preview renders correctly during editing

---

- [ ] U3. **Add `folder` window kind to insert menu and editor**

**Goal:** Make folder windows insertable and editable. The insert button already has backend support (`contentMap` includes `folder`) but is missing from the UI menu. The editor needs a JSON-based entries editor.

**Requirements:** R1, R2, R3

**Dependencies:** U1 (source-step window editor branching)

**Files:**
- Modify: `src/lib/curate/components/UnifiedTracePanel.svelte`
- Modify: `src/lib/curate/components/StepEditorModal.svelte`

**Approach:**
- **Insert menu**: Add "Folder" button to the Content Windows group (after Markdown, line 297)
- **Editor — inserted path**: Add `folder` branch in the window content editor. Use a JSON textarea that parses `FolderEntry[]` with basic validation (valid JSON, array of objects with `name` and `type` fields). Show a validation message if parsing fails.
- **Editor — source path**: Same JSON textarea approach, reading from `overrides.content.entries`

**Patterns to follow:**
- The markdown textarea editor (lines 506-509) for the basic textarea pattern
- `FolderEntry` type definition in `tutorials.ts:222-227` for the expected shape

**Test scenarios:**
- Happy path: Insert a folder window → opens editor with empty JSON array, preview shows empty folder view
- Happy path: Paste valid folder JSON → preview renders the tree structure
- Edge case: Invalid JSON in textarea → validation message shown, preview unchanged
- Edge case: Valid JSON but wrong shape (missing `name` field) → validation message

**Verification:**
- Folder button appears in insert menu
- JSON textarea correctly round-trips folder entry data
- Preview renders the folder tree from the edited JSON

---

- [ ] U4. **Add `window-collection` to insert menu and editor**

**Goal:** Make window-collection insertable and editable with a structured sub-window list editor.

**Requirements:** R1, R2, R3

**Dependencies:** U1 (source-step window editor branching)

**Files:**
- Modify: `src/lib/curate/components/UnifiedTracePanel.svelte`
- Modify: `src/lib/curate/components/StepEditorModal.svelte`
- Modify: `src/routes/curate/[slug]/+page.svelte`

**Approach:**
- **Insert menu**: Add "Window Collection" button to the Content Windows group
- **Insert handler**: Add `'window-collection'` to the `contentMap`:
  `{ kind: 'window-collection', rows: 1, cols: 2, windows: [] }`
- **Editor — inserted path**: Add `window-collection` branch:
  - Number inputs for `rows` and `cols`
  - List of sub-window entries, each with: title input, content kind selector (dropdown of all non-collection kinds), kind-specific fields (src picker for image types, textarea for markdown/source)
  - Add/remove sub-window buttons
- **Editor — source path**: Same structure, reading from `overrides.content`

**Patterns to follow:**
- Question options list editor (lines 302-334) for the add/remove list pattern
- Window content kind branching in the inserted-step editor for per-kind fields

**Test scenarios:**
- Happy path: Insert window-collection → opens editor with 1×2 grid, zero sub-windows
- Happy path: Add two image sub-windows → preview renders 2-up grid with image placeholders
- Happy path: Change a sub-window's kind from image to markdown → fields update to textarea
- Edge case: Collection with zero sub-windows → renders empty grid, no crash

**Verification:**
- Window-collection appears in insert menu
- Sub-window list is fully editable with kind-specific fields
- Preview renders the collection grid with current sub-window data

---

- [ ] U5. **Unify window stacking parameters between desktop and slides**

**Goal:** Eliminate the unnecessary divergence between `DesktopStack.stackStyle()` and `SlidesPlayer.windowStackStyle()` by extracting shared constants.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Create: `src/lib/components/windows/stack-constants.ts`
- Modify: `src/lib/components/tutorial/DesktopStack.svelte`
- Modify: `src/lib/components/slides/SlidesPlayer.svelte`

**Approach:**
- Extract a shared `STACK_PARAMS` object with: `txStep`, `tyStep`, `scaleDecay`, `opacityDecay`, `brightnessDecay`, `minScale`, `minOpacity`, `minBrightness`, `baseZ`, `zStep`
- Use the desktop values as canonical (they're the more polished, established view): `tx=50, ty=-22, scaleDecay=0.04, opacityDecay=0.18, brightnessDecay=0.12, minScale=0.7, minOpacity=0.1, minBrightness=0.35`
- Both `DesktopStack` and `SlidesPlayer` import from the shared constants and use them in their stack style functions
- `DesktopStack` keeps its chromeless branch and box-shadow addition (desktop-specific concerns)
- `SlidesPlayer` drops its `brightness` filter application (not present in the current desktop path for non-chromeless) — actually both have brightness, so they just share the same values

**Patterns to follow:**
- `src/lib/data/tutorials.ts` for the pattern of exporting shared constants/utilities

**Test scenarios:**
- Happy path: Desktop window stack looks identical before and after (visual regression check)
- Happy path: Slides window stack now uses the same offset/scale/opacity as desktop

**Verification:**
- Both files import from `stack-constants.ts`
- No hardcoded stacking magic numbers remain in either file
- Visual appearance of desktop stack is unchanged

---

- [ ] U6. **Allow non-default step types in slides via `slideDuration`**

**Goal:** Give tutorial authors a way to opt specific steps (thinking, tool_call, etc.) into the slides view by setting `slideDuration` on them.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/lib/components/slides/SlidesPlayer.svelte`

**Approach:**
- In the scene model builder (lines 34-52), add a fallback check: after the existing type-based conditions, add a catch-all that includes any step with `slideDuration` set to a positive number
- These opted-in steps render as `kind: 'message'` scene items (reusing the chat bubble rendering) with their `slideDuration` as the duration
- For window steps that already match, `slideDuration` already overrides the default duration (line 44) — no change needed there

**Patterns to follow:**
- The existing `step.slideDuration ?? MESSAGE_DURATION` pattern (line 42)

**Test scenarios:**
- Happy path: A `tool_call` step with `slideDuration: 3000` appears in slides as a message bubble
- Happy path: A `thinking` step with `slideDuration: 2000` appears in slides
- Happy path: A `tool_call` step WITHOUT `slideDuration` is still filtered out (no regression)
- Edge case: `slideDuration: 0` → step is not included (zero is falsy, treated as unset)

**Verification:**
- Only steps with explicit positive `slideDuration` are opted in
- Existing slide behavior is unchanged for steps without `slideDuration`
- Opted-in steps render readable content in the chat bubble

---

## System-Wide Impact

- **Interaction graph:** Changes are confined to the curate editor UI and slides player. No impact on the tutorial viewer, session import, or trace conversion pipeline.
- **Error propagation:** Invalid JSON in the folder editor (U3) should show a validation message, not crash the editor.
- **State lifecycle risks:** None — all editor changes mutate the existing `TraceStep` objects in memory, which are persisted via the existing autosave.
- **API surface parity:** The composition pipeline (`resolve.ts`) already handles all content types — no changes needed there.
- **Unchanged invariants:** `StepRenderer`, `WindowContent`, and all window view components are unchanged. The type system (`tutorials.ts`) is unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Window-collection editor complexity could balloon | Keep it to a flat list of sub-windows with kind selectors — no nested collection editing, no drag-and-drop reordering in v1 |
| Folder JSON editing is error-prone | Show clear validation messages and preserve the last valid state on parse failure |
| Slides `slideDuration` opt-in could produce poor presentations if overused | This is an author choice — the default (filtering out non-essential steps) remains unchanged |

---

## Sources & References

- Code review audit from this session identifying 10 findings across editor coverage and view consistency
- Existing plan: `docs/plans/2026-04-23-001-feat-curate-editor-improvements-plan.md` (complementary, focused on UX)
- Requirements doc: `docs/brainstorms/shared-step-rendering-requirements.md` (related but different scope — rendering unification)
