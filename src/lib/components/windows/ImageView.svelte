<script lang="ts">
	import type { ImageContent } from '$lib/data/tutorials';
	import { base } from '$app/paths';
	import ZoomableView from './ZoomableView.svelte';

	let { content }: { content: ImageContent } = $props();
</script>

<ZoomableView>
	<img src="{base}/{content.src}" alt="" />
</ZoomableView>

<style>
	img {
		display: block;
		max-width: 100%;
		height: auto;
		min-height: 0;
		flex-shrink: 1;
		object-fit: contain;
		background: #1a1a1a;
	}
</style>
