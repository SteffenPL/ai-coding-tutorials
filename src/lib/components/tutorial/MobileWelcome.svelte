<script lang="ts">
	import { getTutorialTitle, type TutorialMeta } from '$lib/data/tutorials';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { langStore } from '$lib/stores/lang.svelte';

	let {
		meta,
		description,
		requirements
	}: {
		meta: TutorialMeta;
		description?: string;
		requirements?: string;
	} = $props();

	let title = $derived(getTutorialTitle(meta, langStore.current));

	let descriptionHtml = $state<string | null>(null);
	$effect(() => {
		if (!description) { descriptionHtml = null; return; }
		let cancelled = false;
		renderMarkdown(description).then(html => { if (!cancelled) descriptionHtml = html; });
		return () => { cancelled = true; };
	});

	let requirementsHtml = $state<string | null>(null);
	$effect(() => {
		if (!requirements) { requirementsHtml = null; return; }
		let cancelled = false;
		renderMarkdown(requirements).then(html => { if (!cancelled) requirementsHtml = html; });
		return () => { cancelled = true; };
	});
</script>

<div class="mobile-welcome">
	<div class="mobile-welcome__card">
		<div class="mobile-welcome__tags">
			{#each meta.tags as tag}
				<span class="mobile-welcome__tag">{tag}</span>
			{/each}
		</div>
		<h2 class="mobile-welcome__heading">{title}</h2>
		{#if meta.author}
			<p class="mobile-welcome__author">by {meta.author}</p>
		{/if}
		{#if descriptionHtml}
			<div class="mobile-welcome__description md">{@html descriptionHtml}</div>
		{/if}
		{#if requirementsHtml}
			<div class="mobile-welcome__requirements md">{@html requirementsHtml}</div>
		{/if}
	</div>
</div>

<style>
	.mobile-welcome {
		display: none;
	}

	@media (max-width: 900px) {
		.mobile-welcome {
			display: block;
			padding: 16px 20px 8px;
		}

		.mobile-welcome__card {
			background: var(--glass-bg-soft);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border: 1px solid var(--border-color);
			border-radius: 14px;
			padding: 20px 20px 16px;
		}

		.mobile-welcome__tags {
			display: flex;
			gap: 6px;
			margin-bottom: 10px;
			flex-wrap: wrap;
		}

		.mobile-welcome__tag {
			font-family: var(--font-mono);
			font-size: 0.6rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--accent);
			background: var(--accent-soft);
			padding: 2px 8px;
			border-radius: 20px;
		}

		.mobile-welcome__heading {
			font-family: var(--font-display);
			font-size: 1.2rem;
			font-weight: 700;
			color: var(--text-primary);
			letter-spacing: -0.02em;
			margin-bottom: 6px;
			line-height: 1.25;
		}

		.mobile-welcome__author {
			font-size: 0.75rem;
			color: var(--text-tertiary);
			margin-bottom: 8px;
			font-family: var(--font-display);
		}

		.mobile-welcome__description {
			font-size: 0.85rem;
			line-height: 1.6;
			color: var(--text-secondary);
			margin-bottom: 12px;
		}

		.mobile-welcome__description :global(p) { margin: 0 0 0.5em; }
		.mobile-welcome__description :global(p:last-child) { margin-bottom: 0; }
		.mobile-welcome__description :global(h1),
		.mobile-welcome__description :global(h2),
		.mobile-welcome__description :global(h3) {
			font-family: var(--font-display);
			font-weight: 600;
			margin: 0.6em 0 0.3em;
			line-height: 1.3;
		}
		.mobile-welcome__description :global(h1:first-child),
		.mobile-welcome__description :global(h2:first-child),
		.mobile-welcome__description :global(h3:first-child) { margin-top: 0; }
		.mobile-welcome__description :global(h1) { font-size: 1rem; color: var(--orange-300); }
		.mobile-welcome__description :global(h2) { font-size: 0.9rem; color: var(--orange-300); }
		.mobile-welcome__description :global(h3) { font-size: 0.85rem; color: var(--orange-300); }
		.mobile-welcome__description :global(strong) { color: var(--text-primary); }
		.mobile-welcome__description :global(ul),
		.mobile-welcome__description :global(ol) { margin: 0 0 0.5em; padding-left: 1.3em; }
		.mobile-welcome__description :global(li) { margin-bottom: 0.2em; }
		.mobile-welcome__description :global(code) {
			font-family: var(--font-mono);
			font-size: 0.85em;
			padding: 0.05em 0.35em;
			background: var(--overlay-light);
			border-radius: 3px;
			color: var(--peach);
		}

		.mobile-welcome__requirements {
			background: var(--overlay-subtle);
			border-radius: 10px;
			padding: 10px 14px;
			font-size: 0.82rem;
			line-height: 1.6;
			color: var(--text-secondary);
		}

		.mobile-welcome__requirements :global(p) { margin: 0 0 0.4em; }
		.mobile-welcome__requirements :global(p:last-child) { margin-bottom: 0; }
		.mobile-welcome__requirements :global(strong) { color: var(--text-primary); }
		.mobile-welcome__requirements :global(ul),
		.mobile-welcome__requirements :global(ol) { margin: 0 0 0.4em; padding-left: 1.2em; }
		.mobile-welcome__requirements :global(li) { margin-bottom: 0.2em; }
	}
</style>
