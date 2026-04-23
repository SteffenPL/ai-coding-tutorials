# Curation Tool Design

> Interactive UI for producing tutorials from Claude Code session logs.

## Problem

Tutorials are hand-authored YAML rounds — high quality but labor-intensive. Raw session logs exist as filtered JSONL and render on `/log/<slug>`, but the gap between a raw log and a curated tutorial requires manual YAML editing. Images from Fiji MCP sessions are added manually with no tooling support.

## Goals

- Select and shorten session blocks visually to produce tutorial YAML
- Group selections into rounds with editable prompts
- Insert non-session content (window steps, terminal rounds) at arbitrary points
- Edit tutorial metadata, welcome, and briefing inline
- Preview the tutorial as it will appear, using actual tutorial components
- Write YAML files to disk during dev via SvelteKit server routes

## Non-Goals

- Automated merging of Fiji MCP traces (manual insertion is sufficient)
- Full log (`fullRounds`) generation (the `/log/<slug>` view covers this)
- Image processing or transformation
- Production deployment of curation endpoints

---

## Architecture

### Data Flow

```
Session JSONL (on disk)
    | loader.ts + viewmodel.ts (existing)
    v
SessionView
    | curation UI (new)
    v
CurationState (in-memory, autosaved to curation.json)
    | export action
    v
round-NN.yaml + meta.yaml (on disk)
    | tutorial-loader.ts (existing, Vite HMR)
    v
Tutorial preview
```

### CurationState

Stored at `src/tutorials/<slug>/curation.json`. Captures selections and edits without touching YAML until explicit export.

```ts
interface CurationState {
  sessionSlug: string
  meta: {
    title: { en: string; ja?: string }
    tags: string[]
    thumbnail?: string            // bare filename in assets/
  }
  welcome?: {
    heading: { en: string; ja?: string }
    description: { en: string; ja?: string }
    learnings: { en: string; ja?: string }[]
  }
  briefing?: string               // markdown
  rounds: CurationRound[]
}

interface CurationRound {
  kind: 'claude' | 'terminal'
  prompt: string                  // editable, can shorten original
  sourceRoundIndex?: number       // links to SessionView round (absent for manual rounds)
  steps: CurationStep[]
}

interface CurationStep {
  // Exactly one of these two shapes:

  // Shape A — sourced from session:
  sourceRef?: { roundIndex: number; nodeIndex: number }
  included: boolean
  shortenedText?: string          // overrides original text content
  comment?: string | { en: string; ja?: string }

  // Shape B — manually inserted (sourceRef absent):
  inserted?: Step                 // any valid tutorial Step type
}
```

### Server Routes (dev-only)

Stripped by the static adapter in production builds.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/curate/[slug]` | `GET` | Load SessionView + existing CurationState |
| `/api/curate/[slug]` | `POST` | Save CurationState to `curation.json` |
| `/api/curate/[slug]/export` | `POST` | Generate `round-NN.yaml` + `meta.yaml` from CurationState |
| `/api/curate/[slug]/upload` | `POST` | Save image/video to `static/tutorials/<slug>/assets/` |

---

## UI Layout

### Route: `/curate/<slug>`

Three-panel layout:

```
+-----------------------------------------------------+
|  Toolbar: [Save] [Export YAML] [Preview ->]   slug   |
+--------------------+--------------------------------+
|                    |                                |
|   SOURCE PANEL     |     CURATED PANEL              |
|   (scrollable)     |     (scrollable)               |
|                    |                                |
|   Session rounds   |     Tutorial header            |
|   with checkboxes  |     (title/tags/welcome/brief) |
|   + round markers  |                                |
|                    |     Tutorial rounds             |
|   [ ] tool_call    |     as they will appear         |
|   [x] tool_result  |     (live step rendering)       |
|   [x] assistant    |                                |
|   [ ] thinking     |     [+ Insert step]            |
|                    |     [+ Add terminal round]     |
|                    |     [+ Add claude round]       |
|                    |                                |
+--------------------+--------------------------------+
|  EDIT DRAWER (slides up when a step is selected)    |
|  - Shorten/edit text  - Add comment  - Set final    |
|  - Window content editor (kind, src, title)         |
+-----------------------------------------------------+
```

### Source Panel (left)

- Renders each SessionView round with its prompt as a sticky header
- Every DisplayNode has a checkbox (include/exclude)
- Clicking a round prompt marks it as a round boundary in the curated output
- Bulk actions: "Include all in round", "Exclude all", "Include tool_calls + results only"
- Excluded steps visually dimmed
- Tool invocations with base64 images show a small thumbnail; including them auto-creates a window step

### Curated Panel (right)

- Tutorial header section (collapsible): title (en/ja), tags, preview image (upload, doubles as thumbnail), welcome fields, briefing markdown textarea
- Round-by-round preview using shared step rendering components from the tutorial viewer
- Steps are reorderable within rounds (drag or up/down buttons)
- Each step has an edit icon that opens the edit drawer
- **[+ Insert step]** buttons between steps and at round ends:
  - Window step (fiji-image, image, video, source, markdown, folder)
  - Terminal output step
  - Status/divider step
  - Manual assistant message
- **[+ Add terminal round]** / **[+ Add claude round]** at the bottom for fully manual rounds

### Edit Drawer (bottom)

Context-sensitive based on step type:

- **Text steps** (assistant, tool_result): editable text area, original shown as reference, "Reset to original" button
- **Comment**: text input with en/ja tabs
- **Window steps**: kind selector dropdown, file upload (via `/api/curate/[slug]/upload`), title/subtitle fields, statusBar for fiji-image
- **Tool_call**: editable code block, toolName field
- **Toggle**: `final: true` for assistant steps

### Terminal Round Creation

- Command input field (becomes the round prompt with `kind: 'terminal'`)
- Add output steps one by one
- Paste-friendly: paste terminal output block, becomes an `output` step
- Can add status steps (success/error badges) between outputs

---

## Export Logic

### CurationState to YAML

1. Each `CurationRound` becomes a `round-NN.yaml` file (01-indexed)
2. Steps emitted in order, skipping those with `included: false`
3. `shortenedText` overrides original text content when present
4. `comment` fields attached to the step they annotate
5. Inserted steps serialized directly as their Step type
6. Image/video references use bare filenames; tutorial-loader rewrites paths

### Tool invocation handling

- Included `tool-invocation` nodes export as `tool_call` + `tool_result` step pair
- User can toggle each half independently via edit drawer
- Base64 images in tool_results: extracted to `static/tutorials/<slug>/assets/` as PNG, replaced with a `window` step referencing the filename

### Round boundaries

- Default: each session round (user prompt) becomes a tutorial round
- User can merge consecutive session rounds into one tutorial round
- Or split a session round into multiple tutorial rounds at arbitrary points

### Meta file

- Export writes/updates `src/tutorials/<slug>/meta.yaml`
- Sets `sessions` to reference the source session, `slug`, `title`, `tags`, `thumbnail`
- Merge semantics: overwrites `title`, `tags`, `thumbnail`, `sessions`, `welcome`, `briefing`; preserves all other fields (e.g. `devOnly`, `order`)
- If `meta.yaml` doesn't exist, creates with defaults

### Overwrite protection

- If `round-NN.yaml` files already exist, show confirmation dialog listing files to be overwritten
- Options: "Overwrite all", "Cancel"

---

## Shared Components

The curation tool reuses existing rendering components:

- **Step renderers** from the tutorial viewer (assistant, tool_call, tool_result, window, etc.)
- **WindowContent.svelte** and its sub-components for preview
- **SessionView display nodes** from the log viewer for the source panel
- **WindowChrome.svelte** for window step previews

New components needed:

- `CurationSourcePanel.svelte` — session view with selection controls
- `CurationCuratedPanel.svelte` — live tutorial preview with insertion points
- `CurationEditDrawer.svelte` — context-sensitive step editor
- `CurationToolbar.svelte` — save/export/preview actions
- `TutorialHeaderEditor.svelte` — meta/welcome/briefing form
- `TerminalRoundEditor.svelte` — terminal round creation form
- `InsertStepMenu.svelte` — dropdown for adding new steps

---

## Constraints

- One Claude Code session per tutorial (no multi-session merging in UI)
- Fiji MCP content inserted manually via window step insertion
- Dev-only: server routes unavailable in production builds
- i18n: comment and title fields support en/ja; briefing is single-language markdown
