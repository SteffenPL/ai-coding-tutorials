<script lang="ts">
	import { themeStore, COLOR_THEMES, WALLPAPERS } from '$lib/stores/theme.svelte';
</script>

<div class="theme-picker">
	<span class="picker-label">Theme</span>
	<div class="theme-swatches">
		{#each COLOR_THEMES as theme}
			<button
				class="swatch"
				class:active={themeStore.colorTheme === theme.id}
				style="--swatch-color: {theme.swatch}"
				title={theme.label}
				onclick={() => (themeStore.colorTheme = theme.id)}
			>
				<span class="swatch-dot"></span>
				<span class="swatch-label">{theme.label}</span>
			</button>
		{/each}
	</div>

	<span class="picker-label">Wallpaper</span>
	<div class="wallpaper-grid">
		{#each WALLPAPERS as wp}
			<button
				class="wp-thumb"
				class:active={themeStore.wallpaper === wp.id}
				title={wp.label}
				onclick={() => (themeStore.wallpaper = wp.id)}
			>
				<span class="wp-preview wp-preview--{wp.id}"></span>
				<span class="wp-name">{wp.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.theme-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.picker-label {
		display: block;
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--text-tertiary);
	}

	/* ─── Color theme swatches ─── */
	.theme-swatches {
		display: flex;
		gap: 4px;
	}

	.swatch {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 8px;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-display);
		font-size: 11px;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.swatch:hover {
		background: var(--bg-hover);
	}

	.swatch.active {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.swatch-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--swatch-color);
		border: 1px solid var(--border-subtle);
	}

	/* ─── Wallpaper grid ─── */
	.wallpaper-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
	}

	.wp-thumb {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 4px;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.wp-thumb:hover {
		background: var(--bg-hover);
	}

	.wp-thumb.active {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.wp-preview {
		width: 36px;
		height: 24px;
		border-radius: 3px;
		overflow: hidden;
	}

	.wp-name {
		font-family: var(--font-display);
		font-size: 9px;
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	/* Mini-previews */
	.wp-preview--mesh-aubergine {
		background: linear-gradient(135deg, #3a0626 0%, #E95420 50%, #521a3a 100%);
	}
	.wp-preview--mesh-ocean {
		background: linear-gradient(135deg, #0a2040 0%, #2088e0 50%, #104060 100%);
	}
	.wp-preview--mesh-forest {
		background: linear-gradient(135deg, #0a2010 0%, #30a050 50%, #103020 100%);
	}
	.wp-preview--dynamic-aurora {
		background: linear-gradient(135deg, #102030 0%, #308080 30%, #604080 70%, #203060 100%);
	}
	.wp-preview--dynamic-particles {
		background: #1a1020;
		position: relative;
	}
	.wp-preview--dynamic-particles::after {
		content: '';
		position: absolute;
		inset: 4px;
		background: radial-gradient(circle 3px at 30% 40%, rgba(233, 130, 60, 0.6) 0%, transparent 100%),
			radial-gradient(circle 2px at 70% 60%, rgba(233, 130, 60, 0.4) 0%, transparent 100%),
			radial-gradient(circle 2px at 50% 25%, rgba(233, 130, 60, 0.5) 0%, transparent 100%);
	}
	.wp-preview--solid-theme {
		background: var(--bg-primary);
	}
	.wp-preview--solid-charcoal {
		background: #1a1a1a;
	}
</style>
