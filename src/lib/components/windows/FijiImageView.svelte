<script lang="ts">
	import type { FijiImageContent } from '$lib/data/tutorials';
	import { base } from '$app/paths';
	import ZoomableView from './ZoomableView.svelte';

	let { content }: { content: FijiImageContent } = $props();
</script>

<ZoomableView>
	<img src="{base}/{content.src}" alt="" />
</ZoomableView>
{#if content.statusBar}
	<div class="statusbar">{content.statusBar}</div>
{/if}

<style>
	img {
		display: block;
		max-width: 100%;
		height: auto;
		min-height: 0;
		flex-shrink: 1;
		object-fit: contain;
		image-rendering: pixelated;
		background: #000;
	}

	.statusbar {
		height: 20px;
		background: #241a20;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-tertiary);
		display: flex;
		align-items: center;
		padding: 0 10px;
		border-top: 1px solid rgba(255, 255, 255, 0.03);
		flex-shrink: 0;
	}
</style>
