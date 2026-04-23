<script lang="ts">
	import type { VideoContent } from '$lib/data/tutorials';
	import { base } from '$app/paths';
	import ZoomableView from './ZoomableView.svelte';

	let { content }: { content: VideoContent } = $props();
</script>

<ZoomableView>
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		src="{base}/{content.src}"
		poster={content.poster ? `${base}/${content.poster}` : undefined}
		loop
		muted
		autoplay
		playsinline
	>
	</video>
</ZoomableView>

<style>
	video {
		display: block;
		width: 100%;
		height: auto;
		min-height: 0;
		flex-shrink: 1;
		object-fit: contain;
		background: #000;
	}
</style>
