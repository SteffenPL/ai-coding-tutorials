# AI Coding Tutorials

Interactive tutorial site that renders Claude Code sessions as explorable, step-by-step webpages with a virtual desktop experience.

**Live site:** https://steffenpl.github.io/ai-coding-tutorials/

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Creating a tutorial

Open the edit dashboard at `/edit` during dev.

### 1. Import a session

Paste the path to a raw Claude Code JSONL file (from `~/.claude/projects/`). The importer filters out PII and noise, writing a clean copy to `src/sessions/<slug>/`.

### 2. Create a trace

Open `/curate/<slug>`. Select which rounds and steps to include, set display modes (compact/normal/full), and add tutorial comments. Saves to `src/traces/<slug>/trace.json`.

### 3. Compose the tutorial

Open `/compose/<slug>`. Add trace blocks (referencing your curated trace) and/or hand-authored rounds. Edit metadata (title, tags, thumbnail, welcome text). Saves to `src/tutorials/<slug>/composition.json` — this is the canonical tutorial format.

### 4. Add assets

Place images/videos in `static/tutorials/<slug>/assets/`. Reference them by bare filename in the composition (e.g., `"src": "step_001.png"`). Shared assets go in `static/assets/` and are referenced with a `shared/` prefix.

### 5. Preview and build

Preview at `/preview/<slug>`. When ready:

```bash
npm run build      # static site to build/
./deploy.sh        # push to gh-pages
```

## Content types

### Step types

| Type | Purpose |
|------|---------|
| `assistant` | Claude's response (teal bar when `final: true`) |
| `thinking` | Collapsible reasoning block |
| `tool_call` | Tool invocation with code |
| `tool_result` | Tool output |
| `permission` | Permission dialog |
| `question` | Q&A with pre-selected answer |
| `output` | Terminal output |
| `status` | Badge (success/info/warning/error) |
| `window` | Desktop window (see below) |
| `table` | Data table |
| `divider` | Visual separator |

### Window content kinds

| Kind | Purpose |
|------|---------|
| `image` | Plain image |
| `fiji-image` | Image with Fiji status bar |
| `video` | Looping muted video |
| `source` | Source code with line numbers |
| `markdown` | Rendered markdown |
| `folder` | File tree view |
| `window-collection` | Grid of sub-windows |

Any step can carry a `comment` (shown in the tutorial panel) and `compact: true` (one-line summary).
