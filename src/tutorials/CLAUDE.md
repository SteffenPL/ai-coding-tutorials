# Tutorials folder

Each tutorial is a self-contained folder under `src/tutorials/<slug>/`.
Content is YAML; TypeScript types live in `src/lib/data/tutorials.ts`.

Raw session logs and curated trace state have moved out of this folder
(see "Pipeline" below). A tutorial folder now contains only what the
production build reads.

## Layout

```
src/tutorials/<slug>/
├── meta.yaml               # title, tags, thumbnail, welcome, briefing, devOnly?
├── composition.json        # optional: compose-tool state (blocks + overrides)
├── tutorial/               # curated rounds, shown by default
│   ├── round-01.yaml
│   └── round-02.yaml
└── full-log/               # optional unabridged log (enables "Log" toggle)
    ├── round-01.yaml
    └── round-02.yaml

static/tutorials/<slug>/assets/
└── *.png / *.mp4           # per-tutorial, referenced by bare filename

static/assets/
└── *.png / *.mp4           # shared across tutorials, referenced as shared/<file>
```

Raw sessions live at `src/sessions/<slug>/` (committed JSONL, see
`src/lib/session/CLAUDE.md`). Curated trace state lives at
`src/traces/<slug>/trace.json`. A slug can appear in any subset of
those locations — nothing is required except `meta.yaml` or
`composition.json` for a published tutorial.

## Pipeline

Two formats are currently in use:

**New (composition-based)** — one `composition.json` references one or
more traces + optional hand-authored rounds. The compose-export step
renders it to `round-NN.yaml + meta.yaml` for the static build.

```
src/sessions/<slug>/           (raw filtered JSONL)
    │
    ▼  /curate/<slug>
src/traces/<slug>/trace.json   (curated TraceState)
    │
    ▼  /compose/<slug>
src/tutorials/<slug>/composition.json
    │
    ▼  /api/compose/[slug]/export
src/tutorials/<slug>/tutorial/round-NN.yaml  +  meta.yaml
```

**Legacy (round-YAML only)** — `install-claude-code` has hand-edited
`round-NN.yaml` files without a composition. The static build still
reads these. Prefer the new pipeline for new tutorials.

## meta.yaml

```yaml
slug: my-tutorial             # should match the folder name
devOnly: false                # omit or false for production; true = hidden in prod build
title:
  en: "..."
  ja: "..."                   # optional
tags: [fiji, segmentation]
thumbnail: step_001.png       # filename in assets/
welcome:                      # optional; shown before playback starts
  heading:     { en, ja? }
  description: { en, ja? }
  learnings:
    - { en: "...", ja?: "..." }
briefing:                     # optional longer HTML shown at the bottom of welcome
  en: "..."
  ja: "..."
```

## Round YAML

```yaml
kind: claude                 # or "terminal" — default: claude
prompt: "User message..."
cwd: ~/workspace/demo        # optional, shown in terminal rounds
steps:
  - type: thinking
    text: "..."
    duration: "3s"
  - type: assistant
    html: "<p>...</p>"
    final: true              # highlights as final answer (teal bar)
    comment: "<p>Optional HTML for the tutorial comment panel.</p>"
```

### Step types (map 1:1 to TS interfaces in `src/lib/data/tutorials.ts`)

| type          | key fields                                                  |
|---------------|-------------------------------------------------------------|
| `assistant`   | `html`, `final?`                                            |
| `thinking`    | `text`, `duration?`                                         |
| `question`    | `html`, `answer`                                            |
| `tool_call`   | `toolName`, `code`                                          |
| `tool_result` | `text`                                                      |
| `permission`  | `tool`, `description`, `granted`                            |
| `output`      | `text`, `stream?` (`stdout`/`stderr`)                       |
| `window`      | `windowTitle`, `subtitle?`, `icon?`, `content` (below)      |
| `table`       | `columns`, `rows`, `moreRows?`                              |
| `status`      | `text`, `variant?` (`success`/`info`/`warning`/`error`)     |
| `divider`     | `label`                                                     |

Any step can carry a `comment` (HTML shown in the comment panel). Steps
with a comment are the "tutorial stops" used by the `Tutorial` detail
level and the `R.T` counter.

Any step can also carry `compact: true` to render as a one-line summary
instead of full content. Set via the compose tool's per-step display
mode toggle, or manually in YAML.

A `comment` may be either a plain HTML string (English-only) or a
localized object with `en` + optional `ja` — the renderer resolves
against the active language and falls back to `en`. Use the object form
when you want Japanese translations for the curated notes; keep the
terminal/session content (prompts, tool calls, outputs) in the original
language, since those are the real trace.

```yaml
- type: assistant
  html: "<p>Original English from the session.</p>"
  comment:
    en: >-
      English note explaining the step.
    ja: >-
      ステップを説明する日本語の注釈。
```

### Window `content` kinds

| kind         | fields                                 |
|--------------|----------------------------------------|
| `fiji-image` | `src`, `statusBar?`                    |
| `image`      | `src`                                  |
| `markdown`   | `text`                                 |
| `source`     | `text`, `language?`                    |
| `folder`     | `entries: FolderEntry[]`               |
| `video`      | `src`, `poster?`                       |

## YAML gotchas

- Use `|-` for multi-line code blocks (preserves newlines, trims final `\n`).
- Quote any value that contains `: ` (colon-space) — YAML would parse it
  as a key-value pair. Example: `text: "✓ completed — active image: x"`.
- Use `>-` for long wrapped HTML that should render as one paragraph.
- Asset refs are **bare filenames** (`step_001.png`) for per-tutorial assets,
  rewritten to `tutorials/<slug>/assets/<file>`. Use **`shared/` prefix**
  (`shared/fiji-logo.png`) for shared assets at `static/assets/`, rewritten
  to `assets/<file>`. A value containing `/` that doesn't start with `shared/`
  is passed through unchanged.

## Build pipeline

1. **Loader** (`src/lib/data/tutorial-loader.ts`) — globs `meta.yaml`,
   `tutorial/round-*.yaml`, `full-log/round-*.yaml` via
   `import.meta.glob('…', { eager: true, query: '?raw', import: 'default' })`,
   parses with `js-yaml`, rewrites asset paths, filters `devOnly` in prod,
   and exposes `getAllTutorials()` / `getTutorialBySlug()`.
2. **Page loader** (`src/routes/tutorials/[slug]/+page.ts`) — uses
   `entries()` to prerender one static page per slug.
3. **Static adapter** — writes `build/tutorials/<slug>.html` + copies
   `static/tutorials/<slug>/assets/`.

Test with `npm run check`, `npm run build`, `npm run dev`.

## Authoring workflow

Open `/edit` during `npm run dev` for the full dashboard. The typical
flow is:

1. **Import session** — paste the path to a raw Claude Code JSONL.
   Writes filtered JSONL to `src/sessions/<slug>/`.
2. **Create trace** — open `/curate/<slug>`, select/deselect steps, set
   compact/full per step, add comments. Saved to `src/traces/<slug>/trace.json`.
3. **Compose tutorial** — open `/compose/<slug>`, add trace blocks
   and/or hand-authored rounds, edit metadata. Saved to
   `src/tutorials/<slug>/composition.json`.
4. **Export YAML** — from `/compose/<slug>`, writes
   `tutorial/round-NN.yaml` + `meta.yaml` ready for the static build.

## CLI workflow (for agents)

`scripts/session-to-tutorial.ts` provides a two-step CLI pipeline:

1. `inspect` — print session structure as JSON (round/step map)
2. `generate` — read a spec YAML and produce `meta.yaml`,
   `tutorial/round-NN.yaml`, `full-log/round-NN.yaml`, and extracted
   image assets.

Spec files live in `specs/<slug>.yaml`. See `scripts/TUTORIAL-WORKFLOW.md`
for the full spec format, agent tips, and end-to-end workflow.

## Legacy script (deprecated)

`scripts/merge-session.ts` predates the curate/compose tools. It
merges a raw JSONL directly into `full-log/round-*.yaml` with base64
image extraction. Still checked in for the existing tutorials that used
it; prefer the new CLI or dashboard for new work.

## devOnly

Setting `devOnly: true` in `meta.yaml` excludes a tutorial from the
production prerender. The YAML is still bundled (eager glob), so keep
devOnly tutorials small.

## Adding a new step type or window kind

1. Add the TS interface to `src/lib/data/tutorials.ts`.
2. Handle the new `type` in `src/lib/components/tutorial/StepRenderer.svelte`
   (terminal step) or add a `*View.svelte` + branch in
   `src/lib/components/windows/WindowContent.svelte` (window kind).
3. If the new kind references assets, extend `rewriteContent` in
   `tutorial-loader.ts` so bare filenames get rewritten.
