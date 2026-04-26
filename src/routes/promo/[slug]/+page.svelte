<script lang="ts">
	import PromoPlayer from '$lib/components/promo/PromoPlayer.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Promo — {data.tutorial.meta.title.en}</title>
</svelte:head>

<PromoPlayer tutorial={data.tutorial} />
