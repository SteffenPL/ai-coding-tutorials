<script lang="ts">
	import SlidesPlayer from '$lib/components/slides/SlidesPlayer.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Slides — {data.tutorial.meta.title.en}</title>
</svelte:head>

<SlidesPlayer tutorial={data.tutorial} initialTheme={data.theme} />
