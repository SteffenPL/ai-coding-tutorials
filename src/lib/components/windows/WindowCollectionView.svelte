<script lang="ts">
	import type { WindowCollectionContent, WindowCollectionEntry } from '$lib/data/tutorials';
	import { getWindowIcon } from '$lib/data/tutorials';
	import WindowChrome from './WindowChrome.svelte';
	import WindowContent from './WindowContent.svelte';

	let { content }: { content: WindowCollectionContent } = $props();
	let maximized = $state<WindowCollectionEntry | null>(null);
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
				onMaximize={() => { maximized = entry; }}
			/>
			<div class="sub-body">
				<WindowContent content={entry.content} />
			</div>
		</div>
	{/each}
</div>

{#if maximized}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="max-backdrop" onclick={() => { maximized = null; }}></div>
	<div class="max-sub-window">
		<WindowChrome
			title={maximized.title}
			subtitle={maximized.subtitle}
			icon={getWindowIcon(maximized.content)}
			isMaximized
			onRestore={() => { maximized = null; }}
		/>
		<div class="max-sub-body">
			<WindowContent content={maximized.content} />
		</div>
	</div>
{/if}

<style>
	.collection-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		gap: 6px;
		justify-content: center;
		align-content: center;
		width: 100%;
		height: 100%;
	}

	.sub-window {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-secondary);
		box-shadow: var(--card-shadow);
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
		display: block;
		width: 100%;
		height: auto;
		object-fit: contain;
		image-rendering: auto;
	}

	/* ── Sub-window maximize overlay ── */
	/* Fixed to viewport, offset by nav height (56px) to cover terminal + desktop */
	.max-backdrop {
		position: fixed;
		inset: 0;
		background: var(--overlay-bg);
		z-index: 300;
	}

	.max-sub-window {
		position: fixed;
		top: 74px;
		left: 22px;
		right: 22px;
		bottom: 22px;
		z-index: 310;
		display: flex;
		flex-direction: column;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-secondary);
		box-shadow: var(--shadow-xl);
		animation: maxPopIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes maxPopIn {
		from { opacity: 0; transform: scale(0.97); }
		to { opacity: 1; transform: scale(1); }
	}

	.max-sub-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
	}

	.max-sub-body :global(.zoom-container) {
		flex: 1 1 auto;
		min-height: 0;
	}

	.max-sub-body :global(.zoom-content) {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.max-sub-body :global(img),
	.max-sub-body :global(video) {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	@media (max-width: 900px) {
		.max-sub-window {
			top: 57px;
			left: 6px;
			right: 6px;
			bottom: 121px;
		}
	}
</style>
