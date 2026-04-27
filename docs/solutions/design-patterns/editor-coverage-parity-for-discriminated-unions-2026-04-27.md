---
title: Editor coverage parity for discriminated unions
date: 2026-04-27
category: design-patterns
module: curate-editor
problem_type: design_pattern
component: tooling
severity: medium
applies_when:
  - Adding a new step type or window content kind to the tutorial type system
  - Reviewing editor completeness after type system changes
  - Building editor UIs for discriminated union types with multiple code paths
tags:
  - svelte
  - discriminated-union
  - editor-parity
  - curate
  - step-editor
  - window-content
  - type-narrowing
---

# Editor coverage parity for discriminated unions

## Context

The curate editor (`StepEditorModal.svelte`) has two parallel code paths for editing steps: `editSourceStep` (session-sourced steps with `overrides`) and `editInsertedStep` (hand-authored steps with `inserted`). Both paths must branch on every step type and, for window steps, on every `WindowContentData.kind`. When new types are added to the type system, both paths and the insert menu must be updated — but the type system itself doesn't enforce this because the editor uses `{#if}/{:else if}` chains that silently fall through for unhandled types.

A code review audit found that 4 of 11 step types and 2 of 7 window content kinds had no editor support, and the source-step window path only handled `src`-bearing kinds (missing `markdown.text`, `source.text+language`, `fiji-image.statusBar`).

## Guidance

When adding a new type to a discriminated union that feeds an editor:

1. **Check all editor paths** — the `editSourceStep` and `editInsertedStep` snippets are independent `{#if}` chains. Both must handle the new type.
2. **Check the insert menu** — `UnifiedTracePanel.svelte` has grouped buttons; `+page.svelte` has the `contentMap` for window kinds.
3. **Use `@const` casts for Svelte 5 type narrowing** — Svelte templates don't narrow discriminated unions through `{:else if obj.kind === 'x'}`. Cast with `{@const wc = ins.content as WindowCollectionContent}` to get a typed local binding.
4. **For complex nested types** (folder entries, window-collection sub-windows), a JSON textarea with validation is pragmatic for rarely-edited types. A structured UI can follow later.

## Why This Matters

Silent fall-through in `{#if}` chains means the editor renders no fields for unhandled types — the modal opens but shows only the comment fields. This blocks tutorial authors from editing content they can see in the viewer. Since the type system and the editor are in different files with no compile-time coupling, coverage drift is the default unless actively checked.

## When to Apply

- After adding a new `StepType` or `WindowContentData` kind to `src/lib/data/tutorials.ts`
- After modifying the structure of an existing step or content type (new fields)
- During periodic editor coverage audits

## Examples

Source-step window editor before (only handled `src`-bearing kinds):

```svelte
{@const content = o.content as Record<string, unknown> | undefined}
{#if content && ('src' in content)}
  <!-- only src field shown — markdown, source, folder invisible -->
{/if}
```

After (branches on `content.kind`):

```svelte
{@const content = o.content as Record<string, unknown> | undefined}
{#if content}
  {@const kind = content.kind as string}
  {#if kind === 'fiji-image' || kind === 'image' || kind === 'video'}
    <!-- src picker + kind-specific fields (statusBar for fiji-image) -->
  {:else if kind === 'markdown'}
    <!-- text textarea -->
  {:else if kind === 'source'}
    <!-- text textarea + language input -->
  {:else if kind === 'folder'}
    <!-- JSON textarea for entries -->
  {:else if kind === 'window-collection'}
    <!-- rows/cols + sub-window list editor -->
  {:else if 'src' in content}
    <!-- fallback for unknown src-bearing kinds -->
  {/if}
{/if}
```

Svelte 5 type narrowing workaround for inserted steps:

```svelte
{:else if ins.content.kind === 'window-collection'}
  {@const wc = ins.content as WindowCollectionContent}
  <!-- wc.rows, wc.cols, wc.windows are now type-safe -->
```

## Related

- [WYSIWYG trace editing via component reuse](../design-patterns/wysiwyg-trace-editing-via-component-reuse-2026-04-23.md) — the shared StepRenderer pattern that makes preview work in the editor
