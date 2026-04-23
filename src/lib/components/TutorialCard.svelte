<script lang="ts">
	import { base } from '$app/paths';
	import Tag from './Tag.svelte';
	import { langStore } from '$lib/stores/lang.svelte';
	import { getTutorialTitle, type Tutorial } from '$lib/data/tutorials';

	interface Props {
		tutorial: Tutorial;
	}

	let { tutorial }: Props = $props();
	let title = $derived(getTutorialTitle(tutorial.meta, langStore.current));
	let isVideo = $derived(!!tutorial.meta.thumbnail && /\.(mp4|mov|webm)$/i.test(tutorial.meta.thumbnail));
</script>

<a href="{base}/tutorials/{tutorial.meta.slug}" class="card">
	<div class="card__image">
		{#if tutorial.meta.thumbnail && isVideo}
			<video src="{base}/{tutorial.meta.thumbnail}" autoplay loop muted playsinline></video>
		{:else if tutorial.meta.thumbnail}
			<img src="{base}/{tutorial.meta.thumbnail}" alt={title} />
		{:else}
			<svg viewBox="0 0 120 120" fill="none">
				<rect x="20" y="30" width="80" height="50" rx="3" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
				<path d="M35 62 L45 55 L35 48" stroke="currentColor" stroke-width="1.5" opacity="0.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
				<line x1="50" y1="62" x2="75" y2="62" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
			</svg>
		{/if}
	</div>
	<div class="card__content">
		<h3 class="card__title">{title}</h3>
		<div class="card__tags">
			{#each tutorial.meta.tags as tag}
				<Tag label={tag} />
			{/each}
		</div>
	</div>
</a>

<style>
	.card {
		display: flex;
		align-items: stretch;
		gap: 20px;
		padding: 16px;
		margin-bottom: 12px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition: all 0.25s ease;
		box-shadow: var(--card-shadow);
		cursor: pointer;
		opacity: 0;
		animation: fadeUp 0.5s ease forwards;
	}

	.card:hover {
		border-color: var(--accent);
		box-shadow: var(--card-shadow-hover);
		transform: translateY(-1px);
		text-decoration: none;
	}

	.card__image {
		width: 130px;
		height: 130px;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--bg-hover);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card__image img,
	.card__image video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card__image svg {
		padding: 20px;
		opacity: 0.7;
		color: var(--accent);
		width: 100%;
		height: 100%;
	}

	.card__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		gap: 10px;
	}

	.card__title {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary);
		line-height: 1.3;
	}

	.card:hover .card__title {
		color: var(--accent);
	}

	.card__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	@media (max-width: 640px) {
		.card {
			flex-direction: column;
			gap: 12px;
			padding: 12px;
		}

		.card__image {
			width: 100%;
			height: 200px;
		}
	}
</style>
