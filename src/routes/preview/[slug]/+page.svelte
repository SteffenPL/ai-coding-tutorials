<script lang="ts">
	import TutorialViewer from '$lib/components/tutorial/TutorialViewer.svelte';

	let { data } = $props();
</script>

<TutorialViewer tutorial={data.tutorial} />
