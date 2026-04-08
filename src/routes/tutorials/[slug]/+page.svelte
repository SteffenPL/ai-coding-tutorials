<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import VideoEmbed from '$lib/components/VideoEmbed.svelte';
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import PromptBox from '$lib/components/PromptBox.svelte';
	import { t } from '$lib/stores/lang.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let tutorial = $derived(data.tutorial);
</script>

<svelte:head>
	<title>{t(tutorial.title)} — ASHBi Tutorials</title>
</svelte:head>

<Nav showBack />

<article class="post">
	<!-- Post Header -->
	<header class="post__header">
		<h1 class="post__title">{t(tutorial.title)}</h1>
		<div class="post__meta-row">
			{#each tutorial.tags as tag}
				<Tag label={tag} />
			{/each}
			<span class="post__date">
				{t({ en: `Updated: ${tutorial.updatedDate}`, ja: `更新: ${tutorial.updatedDate}` })}
			</span>
		</div>
	</header>

	<!-- Video (conditional) -->
	{#if tutorial.hasVideo}
		<div class="post__video-anim">
			<VideoEmbed url={tutorial.videoUrl} />
		</div>
	{/if}

	<!-- Links & Resources -->
	{#if tutorial.githubUrl || (tutorial.links && tutorial.links.length > 0)}
		<div class="post__links">
			{#if tutorial.githubUrl}
				<a href={tutorial.githubUrl} class="post__link" target="_blank" rel="noopener noreferrer">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
					</svg>
					{t({ en: 'GitHub Repository', ja: 'GitHubリポジトリ' })}
				</a>
			{/if}
			{#if tutorial.links}
				{#each tutorial.links as link}
					<a href={link.url} class="post__link" target="_blank" rel="noopener noreferrer">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
						</svg>
						{t(link.label)}
					</a>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Main Content -->
	<div class="post__content">
		{#each tutorial.content as block}
			{#if block.type === 'heading' && block.level === 2}
				<h2>{t(block.text)}</h2>
			{:else if block.type === 'heading' && block.level === 3}
				<h3>{t(block.text)}</h3>
			{:else if block.type === 'text'}
				<p>{@html t(block.body).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>
			{:else if block.type === 'code'}
				<CodeBlock language={block.language} code={block.code} />
			{:else if block.type === 'prompt'}
				<PromptBox body={block.body} />
			{/if}
		{/each}
	</div>
</article>

<Footer />

<style>
	.post {
		position: relative;
		z-index: 1;
		max-width: 720px;
		margin: 0 auto;
		padding: 88px 24px 80px;
	}

	.post__header {
		margin-bottom: 32px;
		opacity: 0;
		animation: fadeUp 0.6s ease forwards;
	}

	.post__title {
		font-family: var(--font-display);
		font-size: clamp(1.7rem, 4vw, 2.4rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.15;
		color: var(--text-primary);
		margin-bottom: 16px;
		transition: color var(--transition-theme);
	}

	.post__meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.post__date {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		transition: color var(--transition-theme);
	}

	.post__video-anim {
		opacity: 0;
		animation: fadeUp 0.6s ease 0.1s forwards;
	}

	.post__links {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 32px;
		opacity: 0;
		animation: fadeUp 0.6s ease 0.15s forwards;
	}

	.post__link {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-family: var(--font-display);
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--shark);
		text-decoration: none;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid var(--shark-tag-border);
		background: var(--shark-tag-bg);
		transition: all 0.2s ease;
	}

	.post__link:hover {
		background: var(--shark);
		color: #ffffff;
		border-color: var(--shark);
	}

	.post__link svg {
		width: 15px;
		height: 15px;
	}

	/* ─── Post Content (markdown-like) ─── */
	.post__content {
		opacity: 0;
		animation: fadeUp 0.6s ease 0.2s forwards;
	}

	.post__content :global(h2) {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		margin-top: 40px;
		margin-bottom: 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border-subtle);
		transition:
			color var(--transition-theme),
			border-color var(--transition-theme);
	}

	.post__content :global(h3) {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary);
		margin-top: 28px;
		margin-bottom: 12px;
		transition: color var(--transition-theme);
	}

	.post__content :global(p) {
		font-size: 0.95rem;
		line-height: 1.75;
		color: var(--text-secondary);
		margin-bottom: 16px;
		transition: color var(--transition-theme);
	}

	.post__content :global(code) {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		padding: 2px 7px;
		border-radius: 5px;
		background: var(--bg-hover);
		border: 1px solid var(--border-subtle);
		color: var(--shark-tag-text);
		transition: all var(--transition-theme);
	}

	.post__content :global(strong) {
		font-weight: 600;
		color: var(--text-primary);
	}

	@media (max-width: 640px) {
		.post {
			padding: 80px 16px 64px;
		}

		.post__title {
			font-size: 1.5rem;
		}

		.post__links {
			flex-direction: column;
		}

		.post__link {
			justify-content: center;
		}
	}
</style>
