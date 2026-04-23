<script lang="ts">
	import type { MultiWindowContent } from '$lib/data/tutorials';
	import WindowContent from './WindowContent.svelte';

	let { content }: { content: MultiWindowContent } = $props();
</script>

<div
	class="multi-grid"
	style="--cols: {content.cols}; --rows: {content.rows};"
>
	{#each content.windows as entry, i}
		<div class="cell" style="--delay: {i * 60}ms;">
			<div class="cell-label">{entry.label}</div>
			<div class="cell-content">
				<WindowContent content={entry.content} />
			</div>
		</div>
	{/each}
</div>

<style>
	.multi-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		gap: 2px;
		background: #1a1216;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: auto;
	}

	.cell {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		background: #0d0a0c;
		animation: cell-appear 0.3s ease both;
		animation-delay: var(--delay);
	}

	@keyframes cell-appear {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.cell-label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-tertiary);
		padding: 4px 8px 2px;
		background: #1a1216;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex-shrink: 0;
	}

	.cell-content {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Override nested image rendering for grid cells */
	.cell-content :global(img) {
		image-rendering: auto;
	}
</style>
