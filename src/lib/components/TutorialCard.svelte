<script lang="ts">
	import Tag from './Tag.svelte';
	import { langStore, t } from '$lib/stores/lang.svelte';
	import type { Tutorial } from '$lib/data/markdown';

	interface Props {
		tutorial: Tutorial;
	}

	let { tutorial }: Props = $props();
	let meta = $derived(tutorial.getMeta(langStore.current));
</script>

<a href="/tutorials/{tutorial.slug}" class="card">
	<div class="card__image">
		<svg viewBox="0 0 120 120" fill="none">
			{#if meta.tags.includes('bioinformatics') && meta.tags.includes('python')}
				<rect x="15" y="30" width="90" height="60" rx="4" stroke="currentColor" stroke-width="2" />
				<polygon points="50,45 50,75 78,60" fill="currentColor" opacity="0.6" />
			{:else if meta.tags.includes('data-analysis')}
				<rect x="20" y="25" width="35" height="70" rx="3" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
				<rect x="65" y="40" width="35" height="55" rx="3" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
				<rect x="42" y="50" width="35" height="45" rx="3" stroke="currentColor" stroke-width="1.5" opacity="0.7" />
				<line x1="15" y1="95" x2="105" y2="95" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
			{:else if meta.tags.includes('image-analysis')}
				<rect x="25" y="25" width="70" height="70" rx="4" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
				<circle cx="50" cy="55" r="15" stroke="currentColor" stroke-width="1.5" opacity="0.6" />
				<circle cx="72" cy="65" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
			{:else if meta.tags.includes('RNA-seq')}
				<path d="M30 90 L40 50 L55 70 L70 35 L85 55 L95 30" stroke="currentColor" stroke-width="2" opacity="0.6" stroke-linecap="round" stroke-linejoin="round" />
				<line x1="25" y1="95" x2="100" y2="95" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
				<line x1="25" y1="25" x2="25" y2="95" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
				<circle cx="70" cy="35" r="3" fill="currentColor" opacity="0.4" />
			{:else}
				<rect x="20" y="30" width="80" height="50" rx="3" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
				<path d="M35 62 L45 55 L35 48" stroke="currentColor" stroke-width="1.5" opacity="0.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
				<line x1="50" y1="62" x2="75" y2="62" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
			{/if}
		</svg>
	</div>
	<div class="card__content">
		<h3 class="card__title">{meta.title}</h3>
		<div class="card__tags">
			{#each meta.tags as tag}
				<Tag label={tag} />
			{/each}
		</div>
		<div class="card__meta">
			{#if meta.hasVideo}
				<span class="badge-video">
					<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
					{t({ en: 'video', ja: '動画' })}
				</span>
			{:else}
				<span>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
					{t({ en: 'code only', ja: 'コードのみ' })}
				</span>
			{/if}
			{#if meta.duration}
				<span>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
					{meta.hasVideo
						? t({ en: `${meta.duration} min`, ja: `${meta.duration}分` })
						: t({ en: `${meta.duration} min read`, ja: `${meta.duration}分で読める` })}
				</span>
			{/if}
			<span>
				{t({ en: `Updated: ${meta.updated}`, ja: `更新: ${meta.updated}` })}
			</span>
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
		border: 1px solid var(--border-subtle);
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
		border-color: var(--shark);
		box-shadow: var(--card-shadow-hover);
		transform: translateY(-1px);
	}

	.card__image {
		width: 130px;
		min-height: 100px;
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--bg-hover);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background var(--transition-theme);
	}

	.card__image svg {
		padding: 20px;
		opacity: 0.7;
		color: var(--shark);
		width: 100%;
		height: 100%;
	}

	.card__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		gap: 8px;
	}

	.card__title {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary);
		transition: color var(--transition-theme);
		line-height: 1.3;
	}

	.card:hover .card__title {
		color: var(--shark);
	}

	.card__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.card__meta {
		font-size: 0.78rem;
		color: var(--text-tertiary);
		display: flex;
		align-items: center;
		gap: 12px;
		transition: color var(--transition-theme);
	}

	.card__meta span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.card__meta svg {
		width: 13px;
		height: 13px;
		opacity: 0.6;
	}

	.badge-video {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--shark);
		background: var(--shark-glow);
		padding: 2px 8px;
		border-radius: 4px;
	}

	.badge-video svg {
		width: 10px;
		height: 10px;
		opacity: 1;
	}

	@media (max-width: 640px) {
		.card {
			flex-direction: column;
			gap: 12px;
			padding: 12px;
		}

		.card__image {
			width: 100%;
			min-height: 140px;
			max-height: 180px;
		}
	}

	@media (min-width: 641px) and (max-width: 900px) {
		.card__image {
			width: 110px;
			min-height: 90px;
		}
	}
</style>
