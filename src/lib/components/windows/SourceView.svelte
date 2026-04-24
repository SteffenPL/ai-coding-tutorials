<!--
	Source code window.
	- Shiki-highlighted (lazy, per-language chunk)
	- Line numbers via CSS counter (no <table>)
	- Copy-to-clipboard button (hover-revealed top-right)
	- Graceful fallback for unsupported languages → plaintext
-->
<script lang="ts">
	import type { SourceContent } from '$lib/data/tutorials';
	import { getHighlighter, resolveLang, THEME } from '$lib/utils/highlighter';

	let { content }: { content: SourceContent } = $props();

	/** Highlighted HTML — null while loading (or if highlighting failed). */
	let highlightedHtml = $state<string | null>(null);
	let copied = $state(false);

	$effect(() => {
		const code = content.text;
		const lang = resolveLang(content.language);
		let cancelled = false;

		(async () => {
			try {
				const hl = await getHighlighter();
				const html = hl.codeToHtml(code, {
					lang: lang ?? 'text',
					theme: THEME,
					transformers: [
						{
							// Tag each line so CSS `counter-increment` can drive line numbers
							line(node) {
								node.properties.class =
									(node.properties.class ? node.properties.class + ' ' : '') + 'line';
							}
						}
					]
				});
				if (!cancelled) highlightedHtml = html;
			} catch {
				// Unknown language or highlighter failed — fall back to plaintext.
				if (!cancelled) highlightedHtml = null;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(content.text);
			copied = true;
			setTimeout(() => (copied = false), 1400);
		} catch {
			// Clipboard may be unavailable (insecure context) — silently ignore.
		}
	}
</script>

<div class="source-body">
	<button
		class="copy-btn"
		class:copied
		type="button"
		aria-label="Copy code"
		onclick={copy}
	>
		{#if copied}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M5 12l5 5L20 7" />
			</svg>
			<span>Copied</span>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<rect x="9" y="9" width="11" height="11" rx="2" />
				<path d="M5 15V5a2 2 0 0 1 2-2h10" />
			</svg>
			<span>Copy</span>
		{/if}
	</button>

	{#if highlightedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags — output is from Shiki, not user input -->
		<div class="shiki-wrap">{@html highlightedHtml}</div>
	{:else}
		<!-- Fallback render (pre-highlight or language unsupported) -->
		<pre class="plain"><code>{content.text}</code></pre>
	{/if}
</div>

<style>
	.source-body {
		position: relative;
		flex: 1;
		overflow: auto;
		background: var(--bg-deep);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
	}

	/* Shiki output wrapper — override Shiki's theme background, keep its colors */
	.shiki-wrap :global(pre.shiki) {
		margin: 0;
		padding: 12px 0;
		background: transparent !important;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
		counter-reset: line;
	}

	.shiki-wrap :global(pre.shiki code) {
		display: block;
		min-width: fit-content;
	}

	/*
	 * Each line is wrapped in <span class="line"> by Shiki, with a literal
	 * `\n` between spans inside the <pre>. Because <pre> preserves whitespace,
	 * those newlines already produce line breaks — we keep `.line` INLINE
	 * (don't set display: block or we'd get double spacing).
	 */
	.shiki-wrap :global(.line::before) {
		counter-increment: line;
		content: counter(line);
		display: inline-block;
		width: 2.25rem;
		padding-right: 12px;
		margin-right: 12px;
		text-align: right;
		color: var(--text-tertiary);
		opacity: 0.55;
		font-size: 11px;
		user-select: none;
		border-right: 1px solid var(--glass-faint);
	}

	/* Plaintext fallback — mirrors Shiki's layout so there's no jump on highlight */
	.plain {
		margin: 0;
		padding: 12px 16px 12px 0;
		color: var(--text-secondary);
		counter-reset: line;
		white-space: pre;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
	}

	.plain code {
		display: block;
	}

	/* Copy button — hover-revealed in the top-right */
	.copy-btn {
		position: absolute;
		top: 8px;
		right: 10px;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px 5px 8px;
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		color: var(--text-secondary);
		background: var(--source-gutter-bg);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		cursor: pointer;
		opacity: 0;
		backdrop-filter: blur(6px);
		transition: opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.source-body:hover .copy-btn,
	.copy-btn:focus-visible {
		opacity: 1;
	}

	.copy-btn:hover {
		color: var(--text-primary);
		border-color: var(--accent);
	}

	.copy-btn.copied {
		opacity: 1;
		color: var(--teal);
		border-color: var(--teal);
	}

	.copy-btn svg {
		width: 13px;
		height: 13px;
	}

	/* Scrollbars — same look as sibling window components */
	.source-body::-webkit-scrollbar { width: 6px; height: 6px; }
	.source-body::-webkit-scrollbar-track { background: transparent; }
	.source-body::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 3px; }
</style>
