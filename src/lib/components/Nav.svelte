<script lang="ts">
	import { base } from '$app/paths';
	import { langStore, t } from '$lib/stores/lang.svelte';
	import ThemePicker from '$lib/components/ThemePicker.svelte';

	interface Props {
		pageTitle?: string;
		editHref?: string;
		slidesHref?: string;
	}

	let { pageTitle, editHref, slidesHref }: Props = $props();
	let showTheme = $state(false);
</script>

<svelte:window onpointerdown={() => showTheme = false} />

<nav class="nav" aria-label="Main navigation">
	<div class="nav__inner">
		<div class="nav__left">
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
			{#if slidesHref}
				<a href={slidesHref} class="nav__slides-btn" title={t({ en: 'View as slides', ja: 'スライド表示' })}>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="2" y="3" width="20" height="14" rx="2" />
						<path d="M8 21h8m-4-4v4" />
					</svg>
					<span class="nav__slides-label">{t({ en: 'Slides', ja: 'スライド' })}</span>
				</a>
			{/if}
			{#if import.meta.env.DEV}
				{#if editHref}
					<a href={editHref} class="nav__link nav__link--dev">Edit</a>
				{/if}
				<a href="{base}/edit" class="nav__link nav__link--dev">Admin</a>
			{/if}
			<a href="{base}/about" class="nav__link">
				{t({ en: 'About', ja: 'About' })}
			</a>
			<div class="theme-wrap">
				<button class="nav__link theme-btn" title="Theme" onclick={(e) => { e.stopPropagation(); showTheme = !showTheme; }}>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="4" />
						<path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
					</svg>
				</button>
				{#if showTheme}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="theme-popover" onpointerdown={(e) => e.stopPropagation()}>
						<ThemePicker />
					</div>
				{/if}
			</div>
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
		padding-top: var(--safe-area-top);
		padding-left: var(--safe-area-left);
		padding-right: var(--safe-area-right);
		background: var(--nav-bg);
		backdrop-filter: blur(16px) saturate(1.2);
		-webkit-backdrop-filter: blur(16px) saturate(1.2);
		border-bottom: 1px solid var(--border-color);
	}

	.nav__inner {
		max-width: 960px;
		margin: 0 auto;
		padding: 0 24px;
		height: var(--nav-content-height);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.nav__left {
		display: flex;
		align-items: center;
		gap: 16px;
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
		background: var(--overlay-subtle);
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
		box-shadow: var(--shadow-sm);
	}

	/* ─── Slides button ─── */
	.nav__slides-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 6px;
		background: var(--overlay-subtle);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 500;
		text-decoration: none;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.nav__slides-btn:hover {
		background: var(--accent-soft);
		border-color: var(--orange-400);
		color: var(--orange-300);
		text-decoration: none;
	}

	.nav__slides-label {
		line-height: 1;
	}

	/* ─── Theme picker ─── */
	.theme-wrap {
		position: relative;
	}

	.theme-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		cursor: pointer;
		background: none;
		border: none;
	}

	.theme-popover {
		position: absolute;
		top: calc(100% + 12px);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		padding: 12px 14px;
		box-shadow: var(--shadow-lg);
		z-index: 150;
		min-width: 260px;
		animation: themePopIn 0.15s ease-out;
	}

	@keyframes themePopIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (max-width: 640px) {
		.nav {
			--nav-content-height: 52px;
		}

		.nav__inner {
			padding: 0 16px;
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

		.nav__slides-label {
			display: none;
		}
	}
</style>
