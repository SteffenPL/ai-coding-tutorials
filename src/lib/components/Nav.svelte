<script lang="ts">
	import { themeStore } from '$lib/stores/theme.svelte';
	import { langStore, t } from '$lib/stores/lang.svelte';

	interface Props {
		showBack?: boolean;
	}

	let { showBack = false }: Props = $props();
</script>

<nav class="nav" aria-label="Main navigation">
	<div class="nav__inner">
		<div class="nav__left">
			{#if showBack}
				<a href="/" class="nav__back" aria-label={t({ en: 'Back to tutorials', ja: 'チュートリアル一覧に戻る' })}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M19 12H5m7-7-7 7 7 7" />
					</svg>
					{t({ en: 'All Tutorials', ja: 'すべてのチュートリアル' })}
				</a>
				<div class="nav__sep" aria-hidden="true"></div>
			{/if}
			<a href="/" class="nav__logo" aria-label="ASHBi Coding Tutorials Home">
				<div class="nav__logo-mark">A</div>
				<span class="nav__logo-text">
					{t({ en: 'ASHBi Tutorials', ja: 'ASHBi チュートリアル' })}
				</span>
			</a>
		</div>
		<div class="nav__controls">
			<div class="lang-switch" role="group" aria-label="Language switcher">
				<button
					class="lang-switch__btn"
					class:active={langStore.current === 'en'}
					onclick={() => langStore.set('en')}
					aria-label="English"
				>
					EN
				</button>
				<button
					class="lang-switch__btn"
					class:active={langStore.current === 'ja'}
					onclick={() => langStore.set('ja')}
					aria-label="Japanese"
				>
					JA
				</button>
			</div>
			<button class="theme-toggle" onclick={() => themeStore.toggle()} aria-label="Toggle dark mode">
				<div class="theme-toggle__knob">
					{#if themeStore.current === 'light'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
						</svg>
					{/if}
				</div>
			</button>
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
		border-bottom: 1px solid var(--border-subtle);
		transition:
			background var(--transition-theme),
			border-color var(--transition-theme);
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
		color: var(--shark);
	}

	.nav__back svg {
		width: 14px;
		height: 14px;
	}

	.nav__sep {
		width: 1px;
		height: 20px;
		background: var(--border-color);
		transition: background var(--transition-theme);
	}

	.nav__logo {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--text-primary);
		text-decoration: none;
		letter-spacing: -0.02em;
		transition: color var(--transition-theme);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nav__logo-mark {
		width: 28px;
		height: 28px;
		background: var(--shark);
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
		transition: background var(--transition-theme);
	}

	.nav__controls {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.lang-switch {
		display: flex;
		align-items: center;
		background: var(--toggle-bg);
		border-radius: 8px;
		padding: 3px;
		gap: 2px;
		transition: background var(--transition-theme);
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
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.theme-toggle {
		width: 44px;
		height: 28px;
		background: var(--toggle-bg);
		border: none;
		border-radius: 14px;
		cursor: pointer;
		position: relative;
		transition: background var(--transition-theme);
		flex-shrink: 0;
	}

	.theme-toggle__knob {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 20px;
		height: 20px;
		background: var(--toggle-knob);
		border-radius: 50%;
		transition:
			transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			background var(--transition-theme);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	:global([data-theme='dark']) .theme-toggle__knob {
		transform: translateX(16px);
	}

	.theme-toggle__knob svg {
		width: 12px;
		height: 12px;
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

		.lang-switch__btn {
			padding: 4px 10px;
			font-size: 0.7rem;
		}
	}
</style>
