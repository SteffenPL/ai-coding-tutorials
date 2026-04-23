<!--
	Markdown window — renders markdown as formatted HTML.
	- marked parser with GFM
	- KaTeX for $…$ inline and $$…$$ display math
	- Shiki-highlighted fenced code blocks (reuses the app-wide highlighter)
	- Plain-text fallback during async load (no blocking first paint)
-->
<script lang="ts">
	import type { MarkdownContent } from '$lib/data/tutorials';
	import { renderMarkdown } from '$lib/utils/markdown';
	// KaTeX stylesheet — Vite processes font @font-face URLs and fingerprints them
	import 'katex/dist/katex.min.css';

	let { content }: { content: MarkdownContent } = $props();

	let renderedHtml = $state<string | null>(null);

	$effect(() => {
		const text = content.text;
		let cancelled = false;

		renderMarkdown(text)
			.then((html) => {
				if (!cancelled) renderedHtml = html;
			})
			.catch(() => {
				if (!cancelled) renderedHtml = null;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="markdown-body">
	{#if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags — output is from marked/Shiki, not user input -->
		<div class="md">{@html renderedHtml}</div>
	{:else}
		<pre class="md-loading">{content.text}</pre>
	{/if}
</div>

<style>
	.markdown-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		font-family: var(--font-display);
		font-size: 13px;
		line-height: 1.65;
		color: var(--text-secondary);
		background: #1e151a;
	}

	.md-loading {
		white-space: pre-wrap;
		word-wrap: break-word;
		margin: 0;
		font-family: inherit;
		color: var(--text-tertiary);
	}

	/* ─── Rendered markdown typography ────────────── */
	.md :global(h1),
	.md :global(h2),
	.md :global(h3),
	.md :global(h4) {
		color: var(--text-primary);
		font-family: var(--font-display);
		font-weight: 600;
		letter-spacing: -0.015em;
		margin: 1.4em 0 0.55em;
		line-height: 1.25;
	}
	.md :global(h1) { font-size: 1.55rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
	.md :global(h2) { font-size: 1.25rem; }
	.md :global(h3) { font-size: 1.05rem; color: var(--peach); }
	.md :global(h4) { font-size: 0.95rem; color: var(--peach); }

	.md :global(h1:first-child),
	.md :global(h2:first-child),
	.md :global(h3:first-child) {
		margin-top: 0;
	}

	.md :global(p) {
		margin: 0 0 0.9em;
	}

	.md :global(a) {
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px dashed rgba(233, 84, 32, 0.4);
		transition: border-color 0.15s ease;
	}
	.md :global(a:hover) {
		border-bottom-color: var(--accent);
	}

	.md :global(strong) { color: var(--text-primary); font-weight: 600; }
	.md :global(em) { color: var(--text-primary); }

	.md :global(ul),
	.md :global(ol) {
		margin: 0 0 0.9em;
		padding-left: 1.4em;
	}
	.md :global(li) { margin: 0.15em 0; }

	.md :global(blockquote) {
		margin: 0 0 0.9em;
		padding: 0.1em 0.9em;
		border-left: 3px solid var(--accent);
		color: var(--text-secondary);
		background: rgba(233, 84, 32, 0.05);
		border-radius: 0 4px 4px 0;
	}
	.md :global(blockquote p:last-child) { margin-bottom: 0; }

	/* Inline code */
	.md :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9em;
		padding: 0.08em 0.4em;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--peach);
	}

	/* Fenced code blocks — Shiki-rendered, unwrap styling so Shiki shows through */
	.md :global(pre) {
		margin: 0 0 0.9em;
		padding: 12px 14px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		overflow-x: auto;
		font-size: 12px;
		line-height: 1.55;
	}
	/* Shiki emits <pre class="shiki">…</pre> — its bg should stay transparent
	   so our outer panel styling wins */
	.md :global(pre.shiki) {
		background: transparent !important;
	}
	/* Inline <code> styling should NOT apply inside fenced blocks */
	.md :global(pre code) {
		padding: 0;
		background: none;
		border: none;
		color: inherit;
		font-size: inherit;
	}

	.md :global(hr) {
		border: 0;
		border-top: 1px solid var(--border-color);
		margin: 1.4em 0;
	}

	/* Tables */
	.md :global(table) {
		border-collapse: collapse;
		margin: 0 0 1em;
		font-size: 12px;
	}
	.md :global(th),
	.md :global(td) {
		padding: 5px 10px;
		border: 1px solid var(--border-color);
		text-align: left;
	}
	.md :global(th) {
		background: rgba(0, 0, 0, 0.25);
		color: var(--text-primary);
		font-weight: 600;
	}

	/* KaTeX math — tone down to match the panel palette */
	.md :global(.katex) {
		font-size: 1em;
		color: var(--text-primary);
	}
	/* Display math — centered block with breathing room */
	.md :global(.katex-display) {
		margin: 1em 0;
		overflow-x: auto;
		overflow-y: hidden;
	}

	/* Scrollbar */
	.markdown-body::-webkit-scrollbar { width: 6px; }
	.markdown-body::-webkit-scrollbar-track { background: transparent; }
	.markdown-body::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 3px; }
</style>
