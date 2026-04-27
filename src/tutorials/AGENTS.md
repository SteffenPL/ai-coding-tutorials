# Tutorials folder

Each tutorial is a self-contained folder under `src/tutorials/<slug>/`.
The canonical format is `composition.json` (JSON); TypeScript types live
in `src/lib/data/tutorials.ts` and `src/lib/compose/types.ts`.

## Layout

```
src/tutorials/<slug>/
└── composition.json        # canonical tutorial definition (blocks + meta)

static/tutorials/<slug>/assets/
└── *.png / *.mp4           # per-tutorial, referenced by bare filename

static/assets/
└── *.png / *.mp4           # shared across tutorials, referenced as shared/<file>
```

Raw sessions live at `src/sessions/<slug>/` (committed JSONL, see
`src/lib/session/CLAUDE.md`). Curated trace state lives at
`src/traces/<slug>/trace.json`. A slug can appear in any subset of
those locations — `composition.json` is required for a published tutorial.

## Pipeline

```
src/sessions/<slug>/           (raw filtered JSONL, with header event)
    │
    ▼  /curate/<slug>
src/traces/<slug>/trace.json   (curated TraceState, with formatVersion)
    │
    ▼  /compose/<slug>
src/tutorials/<slug>/composition.json  (with formatVersion)
    │
    ▼  tutorial-loader.ts (build time)
Tutorial object → rendered by TutorialViewer
```

The tutorial-loader globs `composition.json` files and resolves them
at build time via `resolveComposition()`. No YAML export step needed.

## composition.json

```json
{
  "formatVersion": "1.0.0",
  "slug": "my-tutorial",
  "meta": {
    "slug": "my-tutorial",
    "title": { "en": "My Tutorial", "ja": "..." },
    "tags": ["fiji", "segmentation"],
    "thumbnail": "step_001.png",
    "author": "Author Name"
  },
  "welcome": {
    "heading": { "en": "..." },
    "description": { "en": "..." },
    "learnings": [{ "en": "..." }]
  },
  "devOnly": false,
  "blocks": [
    { "kind": "trace", "sourceSlug": "my-trace" }
  ],
  "fullBlocks": [...]
}
```

Blocks reference traces (`kind: "trace"`). Hand-authored content lives
in traces as `inserted` steps (no session source required).
`fullBlocks` is optional and provides the unabridged log (enables
"Full Log" toggle).

## Round structure (inside blocks)

```json
{
  "kind": "claude",
  "prompt": "User message...",
  "cwd": "~/workspace/demo",
  "steps": [
    { "type": "thinking", "text": "...", "duration": "3s" },
    { "type": "assistant", "html": "<p>...</p>", "final": true,
      "comment": { "en": "Tutorial note", "ja": "..." } }
  ]
}
```

### Step types (map 1:1 to TS interfaces in `src/lib/data/tutorials.ts`)

**Claude rounds** — all step types allowed:

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

**Terminal rounds** — only these step types are valid (AI types are
filtered out at build time with a warning):

| type          | key fields                                                  |
|---------------|-------------------------------------------------------------|
| `output`      | `text`, `stream?` (`stdout`/`stderr`)                       |
| `status`      | `text`, `variant?` (`success`/`info`/`warning`/`error`)     |
| `question`    | `html`, `answer` (for CLI prompts)                          |
| `window`      | `windowTitle`, `subtitle?`, `icon?`, `content` (below)      |
| `table`       | `columns`, `rows`, `moreRows?`                              |
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
| `window-collection` | `rows`, `cols`, `windows: {title, subtitle?, content}[]` |

## Asset references

Asset refs are **bare filenames** (`step_001.png`) for per-tutorial assets,
rewritten to `tutorials/<slug>/assets/<file>`. Use **`shared/` prefix**
(`shared/fiji-logo.png`) for shared assets at `static/assets/`, rewritten
to `assets/<file>`. A value containing `/` that doesn't start with `shared/`
is passed through unchanged.

## Build pipeline

1. **Loader** (`src/lib/data/tutorial-loader.ts`) — globs
   `composition.json` files via `import.meta.glob`, parses JSON, resolves
   via `resolveComposition()`, rewrites asset paths, filters `devOnly` in
   prod, validates `formatVersion`, and exposes `getAllTutorials()` /
   `getTutorialBySlug()`.
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
   add trace blocks, edit metadata. Saved to
   `src/tutorials/<slug>/composition.json`. The static build reads
   this directly — no export step needed.

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

Setting `"devOnly": true` in `composition.json` excludes a tutorial
from the production prerender.

## Adding a new step type or window kind

1. Add the TS interface to `src/lib/data/tutorials.ts`.
2. Handle the new `type` in `src/lib/components/tutorial/StepRenderer.svelte`
   (terminal step) or add a `*View.svelte` + branch in
   `src/lib/components/windows/WindowContent.svelte` (window kind).
3. If the new kind references assets, extend `rewriteContent` in
   `src/lib/compose/resolve.ts` so bare filenames get rewritten.
