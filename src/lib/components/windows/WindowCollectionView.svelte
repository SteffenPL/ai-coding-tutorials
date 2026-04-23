<script lang="ts">
	import type { WindowCollectionContent } from '$lib/data/tutorials';
	import { getWindowIcon } from '$lib/data/tutorials';
	import WindowChrome from './WindowChrome.svelte';
	import WindowContent from './WindowContent.svelte';

	let { content }: { content: WindowCollectionContent } = $props();
</script>

<div
	class="collection-grid"
	style="--cols: {content.cols}; --rows: {content.rows};"
>
	{#each content.windows as entry, i}
		<div class="sub-window" style="--delay: {i * 80}ms;">
			<WindowChrome
				title={entry.title}
				subtitle={entry.subtitle}
				icon={getWindowIcon(entry.content)}
			/>
			<div class="sub-body">
				<WindowContent content={entry.content} />
			</div>
		</div>
	{/each}
</div>

<style>
	.collection-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		gap: 6px;
		padding: 6px;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: auto;
	}

	.sub-window {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-secondary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		animation: sub-appear 0.35s ease both;
		animation-delay: var(--delay);
	}

	@keyframes sub-appear {
		from {
			opacity: 0;
			transform: scale(0.88) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.sub-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.sub-body :global(img) {
		image-rendering: auto;
	}
</style>
