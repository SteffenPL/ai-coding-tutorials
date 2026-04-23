<script lang="ts">
	import { base } from '$app/paths';
	import { langStore, t } from '$lib/stores/lang.svelte';

	interface Props {
		showBack?: boolean;
		pageTitle?: string;
	}

	let { showBack = false, pageTitle }: Props = $props();
</script>

<nav class="nav" aria-label="Main navigation">
	<div class="nav__inner">
		<div class="nav__left">
			{#if showBack}
				<a href="{base}/" class="nav__back">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M19 12H5m7-7-7 7 7 7" />
					</svg>
					{t({ en: 'All Tutorials', ja: 'すべてのチュートリアル' })}
				</a>
				<div class="nav__sep" aria-hidden="true"></div>
			{/if}
			<a href="{base}/" class="nav__logo">
				<div class="nav__logo-mark">A</div>
				<span class="nav__logo-text">
					{t({ en: 'AI Tutorials', ja: 'AI チュートリアル' })}
				</span>
			</a>
			{#if pageTitle}
				<div class="nav__sep" aria-hidden="true"></div>
				<span class="nav__page-title">{pageTitle}</span>
			{/if}
		</div>
		<div class="nav__controls">
			{#if import.meta.env.DEV}
				<a href="{base}/edit" class="nav__link nav__link--dev">Edit</a>
			{/if}
			<a href="{base}/about" class="nav__link">
				{t({ en: 'About', ja: 'About' })}
			</a>
			<div class="lang-switch" role="group" aria-label="Language switcher">
				<button
					class="lang-switch__btn"
					class:active={langStore.current === 'en'}
					onclick={() => langStore.set('en')}
				>
					EN
				</button>
				<button
					class="lang-switch__btn"
					class:active={langStore.current === 'ja'}
					onclick={() => langStore.set('ja')}
				>
					JA
				</button>
			</div>
		</div>
	</div>
</nav>

<style>
	.nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--nav-bg);
		backdrop-filter: blur(16px) saturate(1.2);
		-webkit-backdrop-filter: blur(16px) saturate(1.2);
		border-bottom: 1px solid var(--border-color);
	}

	.nav__inner {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 24px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.nav__left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.nav__back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-tertiary);
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.nav__back:hover {
		color: var(--accent);
		text-decoration: none;
	}

	.nav__back svg {
		width: 14px;
		height: 14px;
	}

	.nav__sep {
		width: 1px;
		height: 20px;
		background: var(--border-color);
	}

	.nav__page-title {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 300px;
	}

	.nav__logo {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--text-primary);
		text-decoration: none;
		letter-spacing: -0.02em;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nav__logo:hover {
		text-decoration: none;
	}

	.nav__logo-mark {
		width: 28px;
		height: 28px;
		background: var(--accent);
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.nav__controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.nav__link {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.nav__link:hover {
		color: var(--accent);
		text-decoration: none;
	}

	.nav__link--dev {
		color: var(--accent);
		opacity: 0.7;
		font-size: 0.78rem;
	}

	.lang-switch {
		display: flex;
		align-items: center;
		background: rgba(0, 0, 0, 0.25);
		border-radius: 8px;
		padding: 3px;
		gap: 2px;
	}

	.lang-switch__btn {
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		padding: 5px 12px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		background: transparent;
		color: var(--text-tertiary);
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.lang-switch__btn.active {
		background: var(--bg-secondary);
		color: var(--text-primary);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	@media (max-width: 640px) {
		.nav__inner {
			padding: 0 16px;
			height: 52px;
		}

		.nav__logo-text {
			display: none;
		}

		.nav__sep {
			display: none;
		}

		.nav__page-title {
			display: none;
		}

		.lang-switch__btn {
			padding: 4px 10px;
			font-size: 0.7rem;
		}
	}
</style>
