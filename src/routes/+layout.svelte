<script lang="ts">
	import '$lib/styles/global.css';
	import { themeStore } from '$lib/stores/theme.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	// Ensure theme store is initialized on app load (triggers DOM attribute setting)
	void themeStore.colorTheme;
</script>

{@render children()}
