<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import VideoEmbed from '$lib/components/VideoEmbed.svelte';
	import { langStore, t } from '$lib/stores/lang.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let tutorial = $derived(data.tutorial);
	let meta = $derived(tutorial.getMeta(langStore.current));
	let html = $derived(tutorial.getHtml(langStore.current));

	/**
	 * After the HTML is rendered, hydrate copy buttons and localized labels.
	 */
	function hydrateContent(node: HTMLElement) {
		function update() {
			const lang = langStore.current;
			const copyLabel = lang === 'ja' ? 'コピー' : 'Copy';
			const copiedLabel = lang === 'ja' ? 'コピー済み' : 'Copied!';
			const promptLabel = lang === 'ja' ? 'このプロンプトを試してみましょう' : 'Try this prompt';

			// Set prompt labels
			node.querySelectorAll('[data-t-prompt-label]').forEach((el) => {
				el.textContent = promptLabel;
			});

			// Set copy labels
			node.querySelectorAll('[data-t-copy-label]').forEach((el) => {
				if (!el.closest('.copied')) {
					el.textContent = copyLabel;
				}
			});

			// Hydrate code copy buttons
			node.querySelectorAll('[data-copy-code]').forEach((btn) => {
				if (btn.hasAttribute('data-hydrated')) return;
				btn.setAttribute('data-hydrated', '');
				btn.addEventListener('click', () => {
					const codeBlock = btn.closest('.code-block');
					const code = codeBlock?.querySelector('pre code')?.textContent || '';
					navigator.clipboard.writeText(code).then(() => {
						btn.classList.add('copied');
						const label = btn.querySelector('[data-t-copy-label]');
						if (label) label.textContent = copiedLabel;
						setTimeout(() => {
							btn.classList.remove('copied');
							if (label) label.textContent = copyLabel;
						}, 2000);
					});
				});
			});

			// Hydrate prompt copy buttons
			node.querySelectorAll('[data-copy-prompt]').forEach((btn) => {
				if (btn.hasAttribute('data-hydrated')) return;
				btn.setAttribute('data-hydrated', '');
				btn.addEventListener('click', () => {
					const promptBox = btn.closest('.prompt-box');
					const text = promptBox?.querySelector('.prompt-box__content')?.textContent || '';
					navigator.clipboard.writeText(text).then(() => {
						btn.classList.add('copied');
						const label = btn.querySelector('[data-t-copy-label]');
						if (label) label.textContent = copiedLabel;
						setTimeout(() => {
							btn.classList.remove('copied');
							if (label) label.textContent = copyLabel;
						}, 2000);
					});
				});
			});
		}

		update();

		// Re-run on content change (language switch swaps HTML)
		const observer = new MutationObserver(update);
		observer.observe(node, { childList: true, subtree: true });

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<svelte:head>
	<title>{meta.title} — ASHBi Tutorials</title>
</svelte:head>

<Nav showBack />

<article class="post">
	<!-- Post Header -->
	<header class="post__header">
		<h1 class="post__title">{meta.title}</h1>
		<div class="post__meta-row">
			{#each meta.tags as tag}
				<Tag label={tag} />
			{/each}
			<span class="post__date">
				{t({ en: `Updated: ${meta.updated}`, ja: `更新: ${meta.updated}` })}
			</span>
		</div>
	</header>

	<!-- Video (conditional) -->
	{#if meta.hasVideo}
		<div class="post__video-anim">
			<VideoEmbed url={meta.videoUrl} />
		</div>
	{/if}

	<!-- Links & Resources -->
	{#if meta.githubUrl || (meta.links && meta.links.length > 0)}
		<div class="post__links">
			{#if meta.githubUrl}
				<a href={meta.githubUrl} class="post__link" target="_blank" rel="noopener noreferrer">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
					</svg>
					{t({ en: 'GitHub Repository', ja: 'GitHubリポジトリ' })}
				</a>
			{/if}
			{#if meta.links}
				{#each meta.links as link}
					<a href={link.url} class="post__link" target="_blank" rel="noopener noreferrer">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
						</svg>
						{link.label}
					</a>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Main Content (rendered markdown HTML) -->
	{#key html}
		<div class="post__content" use:hydrateContent>
			{@html html}
		</div>
	{/key}
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

	/* ─── Post Content (markdown HTML) ─── */
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

	/* Inline code (not inside code blocks) */
	.post__content :global(p code),
	.post__content :global(li code) {
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

	.post__content :global(ul),
	.post__content :global(ol) {
		margin-bottom: 16px;
		padding-left: 24px;
	}

	.post__content :global(li) {
		font-size: 0.95rem;
		line-height: 1.75;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.post__content :global(li::marker) {
		color: var(--shark);
	}

	.post__content :global(a) {
		color: var(--shark);
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: var(--shark-tag-border);
	}

	.post__content :global(a:hover) {
		text-decoration-color: var(--shark);
	}

	/* Code block styles (rendered from markdown) */
	.post__content :global(.code-block) {
		margin-bottom: 20px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		transition: border-color var(--transition-theme);
	}

	.post__content :global(.code-block__header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background: var(--code-header);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.post__content :global(.code-block__lang) {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.post__content :global(.code-block__copy) {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 500;
		color: var(--shark-tag-text);
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 5px;
		padding: 3px 10px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.post__content :global(.code-block__copy:hover) {
		background: var(--shark);
		color: #ffffff;
		border-color: var(--shark);
	}

	.post__content :global(.code-block__copy.copied) {
		background: #2ea043;
		color: #ffffff;
		border-color: #2ea043;
	}

	.post__content :global(.code-block__copy svg) {
		width: 12px;
		height: 12px;
	}

	.post__content :global(.code-block pre) {
		padding: 16px;
		background: var(--code-bg);
		overflow-x: auto;
		transition: background var(--transition-theme);
	}

	.post__content :global(.code-block pre code) {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		line-height: 1.65;
		color: var(--code-text);
		tab-size: 4;
		/* Reset inline code styles inside code blocks */
		padding: 0;
		border-radius: 0;
		background: none;
		border: none;
	}

	/* Prompt box styles (rendered from markdown) */
	.post__content :global(.prompt-box) {
		margin: 24px 0;
		border-radius: 10px;
		border: 1px solid var(--prompt-border);
		border-left: 4px solid var(--shark);
		background: var(--prompt-bg);
		overflow: hidden;
		transition: all var(--transition-theme);
	}

	.post__content :global(.prompt-box__header) {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--prompt-border);
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--shark);
	}

	.post__content :global(.prompt-box__header svg) {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.post__content :global(.prompt-box__copy) {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--shark-tag-text);
		background: transparent;
		border: 1px solid var(--shark-tag-border);
		border-radius: 5px;
		padding: 2px 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.post__content :global(.prompt-box__copy:hover) {
		background: var(--shark);
		color: #ffffff;
		border-color: var(--shark);
	}

	.post__content :global(.prompt-box__copy.copied) {
		background: #2ea043;
		color: #ffffff;
		border-color: #2ea043;
	}

	.post__content :global(.prompt-box__copy svg) {
		width: 10px;
		height: 10px;
	}

	.post__content :global(.prompt-box__content) {
		padding: 14px 16px;
		font-family: var(--font-mono);
		font-size: 0.84rem;
		line-height: 1.65;
		color: var(--prompt-text);
		white-space: pre-wrap;
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

		.post__content :global(.code-block pre) {
			padding: 12px;
		}

		.post__content :global(.code-block pre code) {
			font-size: 0.76rem;
		}
	}
</style>
