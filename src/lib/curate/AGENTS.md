# Curate tool

Dev-only interactive UI for turning a filtered session log into a
curated **trace** (the first editorial pass). Available at
`/curate/<slug>` during `npm run dev`.

A trace is an intermediate artefact — it selects which session steps
matter, sets compact/full per step, captures comment annotations, and
stores simple edits. Traces are consumed as building blocks by the
compose tool (`/compose/<slug>`), which assembles one or more traces
plus hand-authored rounds into a published tutorial.

## Pipeline

```
SessionView (from session/loader.ts + viewmodel.ts)
    │
    │  sessionViewToTraceState()        ← src/lib/trace/convert.ts
    ▼
TraceState  (persisted as src/traces/<slug>/trace.json)
    │
    │  consumed by /compose/<slug>
    ▼
TutorialComposition  (composition.json) → round-NN.yaml + meta.yaml
```

`TraceState` is defined in `src/lib/trace/types.ts`; curate reads and
writes it through `/api/traces/[slug]`.

## TraceState

Persisted at `src/traces/<slug>/trace.json`. The editor autosaves
through the server POST endpoint.

Key properties of `TraceStep`:
- `included: boolean` — whether the step is in the trace
- `displayMode: 'compact' | 'full'` — per-step rendering mode
- `hidden?: boolean` — collapsed in simplified view, shown in full log
- `sourceRef?` — links back to the SessionView round/node (for session-sourced steps)
- `inserted?` — a manually added Step (for non-session content)
- `shortenedText?` — overrides original text content
- `comment?` — tutorial annotation (en/ja)
- `overrides?` — mutable snapshot of the session node's data

Exactly one of `sourceRef` or `inserted` is present on a step.
Blank traces (no session) have only `inserted` steps.

## Per-step display mode

Each step has `displayMode: 'compact' | 'full'`:
- **full** (default) — renders with full content in the tutorial
- **compact** — exports with `compact: true` in YAML; renderer shows a
  one-line summary

Toggled via the `▪`/`▣` button on the step toolbar or in the step editor modal.

## Server routes

Traces persist through `/api/traces/[slug]` (GET/POST/DELETE for
`trace.json`, plus `preview` for in-memory Tutorial preview — see root
CLAUDE.md for the full table). Upload uses `/api/compose/[slug]/upload`
— assets land next to other tutorial assets regardless of whether the
trace or composition tool initiated the upload.

## UI layout

Layout at `/curate/<slug>`:
- **Metadata section** (top, full-width) — trace title
- **Unified trace panel** (full-width) — terminal-dark background,
  rounds with real prompt styling (orange bar for claude, green for
  terminal). Steps rendered via `StepRenderer` (same as tutorial viewer)
  with a floating toolbar on hover (edit, compact/full, hide, move,
  exclude/remove). Excluded steps shown as collapsed rows.
- **Step editor modal** (full-screen) — opens on edit click. Left pane:
  all step fields. Right pane: live preview using StepRenderer.
- **Toolbar** — Save, Preview buttons. There is no "Export YAML" here;
  export to tutorial YAML happens in the compose step.
- **Blank traces** — creating a trace without a session starts empty
  with only the insert-step menu. Navigate to `/curate/<slug>` for any
  slug, or use the "New Trace" button on the edit dashboard.

## Files

```
src/lib/curate/
├── components/           UI building blocks for the /curate page
│   ├── UnifiedTracePanel.svelte  WYSIWYG trace editor with real step rendering
│   ├── StepEditorModal.svelte    full-screen step editor with live preview
│   └── step-helpers.ts           label/preview/icon/count helpers
└── CLAUDE.md             this file

src/lib/trace/            state types, conversion, preview store
├── types.ts              TraceState, TraceStep, DisplayMode
├── convert.ts            SessionView ↔ TraceState ↔ TutorialRound[]
└── preview-store.ts      in-memory Map<slug, Tutorial>

src/lib/components/tutorial/
└── TutorialViewer.svelte shared tutorial renderer (used by /tutorials and /preview)

src/routes/curate/[slug]/
├── +page.ts              loader (session → SessionView)
└── +page.svelte          curation UI

src/routes/preview/[slug]/
├── +page.ts              loader
└── +page.svelte          renders TutorialViewer

src/routes/api/traces/[slug]/
├── +server.ts            GET/POST/DELETE trace.json
└── preview/+server.ts    POST store / GET retrieve preview Tutorial
```

## Adding a session to curate

Use the `/edit` dashboard — paste the path to a raw JSONL, and it
writes the filtered file to `src/sessions/<slug>/`. The curate link in
the dashboard opens `/curate/<slug>` with the session preloaded.

CLI equivalent:

```bash
npx tsx scripts/import-session.ts \
  --session ~/.claude/projects/<proj>/<uuid>.jsonl \
  --out     src/sessions/<slug>
npm run dev
open http://localhost:5173/curate/<slug>
```
