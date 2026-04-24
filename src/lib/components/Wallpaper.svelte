<script lang="ts">
	import { themeStore } from '$lib/stores/theme.svelte';

	const wallpaper = $derived(themeStore.wallpaper);
	const isGradient = $derived(wallpaper.startsWith('mesh-'));
</script>

<div class="wallpaper">
	{#if isGradient}
		<div class="wallpaper-gradient wallpaper-gradient--{wallpaper}"></div>
	{/if}
</div>

<style>
	.wallpaper {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		background: var(--wallpaper-base);
	}

	.wallpaper-gradient {
		position: absolute;
		inset: 0;
		filter: blur(40px) saturate(1.5);
	}

	.wallpaper-gradient--mesh-aubergine {
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(233, 84, 32, 0.52) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(245, 140, 55, 0.32) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(200, 60, 115, 0.24) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(210, 110, 170, 0.32) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(250, 160, 60, 0.26) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(150, 60, 140, 0.22) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(255, 130, 60, 0.50) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(255, 185, 110, 0.42) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(78, 22, 54, 0.45) 0%, transparent 70%),
			var(--wallpaper-gradient);
	}

	.wallpaper-gradient--mesh-ocean {
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(32, 120, 200, 0.48) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(55, 150, 220, 0.30) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(40, 100, 180, 0.22) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(80, 160, 210, 0.32) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(30, 140, 190, 0.24) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(40, 80, 160, 0.22) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(60, 180, 230, 0.44) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(120, 200, 240, 0.36) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(15, 30, 60, 0.50) 0%, transparent 70%),
			var(--wallpaper-gradient);
	}

	.wallpaper-gradient--mesh-forest {
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(32, 150, 70, 0.44) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(60, 170, 50, 0.28) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(30, 110, 70, 0.22) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(80, 170, 100, 0.30) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(50, 140, 90, 0.22) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(25, 90, 55, 0.22) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(70, 190, 90, 0.40) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(130, 210, 110, 0.32) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(15, 40, 25, 0.50) 0%, transparent 70%),
			var(--wallpaper-gradient);
	}

	.wallpaper-gradient--mesh-sunset {
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(220, 120, 30, 0.50) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(240, 160, 50, 0.32) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(200, 80, 40, 0.24) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(230, 140, 80, 0.30) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(200, 100, 30, 0.26) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(180, 60, 30, 0.22) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(240, 180, 60, 0.46) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(255, 210, 100, 0.38) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(60, 20, 10, 0.50) 0%, transparent 70%),
			var(--wallpaper-gradient);
	}
</style>
