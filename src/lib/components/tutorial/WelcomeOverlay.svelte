<!--
	Tutorial welcome overlay — intro card shown before playback.

	Dismiss: clicking the backdrop triggers `onDismiss` (parent also wires wheel/scroll
	listeners to dismiss, so we don't handle those here). Clicking inside the card
	does NOT dismiss — stopPropagation on the card's pointerdown.

	Start buttons: "Start Tutorial" (always) + "Full Log" (when hasFullLog). Each
	picks a log mode and dismisses in one action via `onStart(mode)`.
-->
<script lang="ts">
	import { t } from '$lib/stores/lang.svelte';
	import type { TutorialWelcome } from '$lib/data/tutorials';

	let {
		welcome,
		tags,
		hasFullLog,
		onStart,
		onDismiss
	}: {
		welcome: TutorialWelcome;
		tags: string[];
		hasFullLog: boolean;
		onStart: (mode: 'simplified' | 'full') => void;
		onDismiss: () => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="welcome-overlay" onpointerdown={onDismiss}>
	<div class="welcome-card" onpointerdown={(e) => e.stopPropagation()}>
		<div class="welcome-tags">
			{#each tags as tag}
				<span class="welcome-tag">{tag}</span>
			{/each}
		</div>
		<h2 class="welcome-heading">{t(welcome.heading)}</h2>
		<p class="welcome-description">{t(welcome.description)}</p>
		{#if welcome.learnings.length > 0}
			<div class="welcome-learnings">
				<span class="welcome-learnings-label">{t({ en: 'What you\u2019ll see', ja: '学べること' })}</span>
				<ul>
					{#each welcome.learnings as item}
						<li>{t(item)}</li>
					{/each}
				</ul>
			</div>
		{/if}
		<div class="welcome-actions">
			<button class="welcome-start" onclick={() => onStart('simplified')}>
				{t({ en: 'Start Tutorial', ja: 'チュートリアルを開始' })}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5 12h14m-7-7 7 7-7 7" />
				</svg>
			</button>
			{#if hasFullLog}
				<button class="welcome-full-log" onclick={() => onStart('full')}>
					{t({ en: 'Full Log', ja: '完全ログ' })}
				</button>
			{/if}
		</div>
		<span class="welcome-hint welcome-hint--desktop">{t({ en: 'or click anywhere to dismiss', ja: 'または画面をクリックして閉じる' })}</span>
		<span class="welcome-hint welcome-hint--mobile">{t({ en: 'or tap anywhere to dismiss', ja: 'またはタップして閉じる' })}</span>
	</div>
</div>

<style>
	.welcome-overlay {
		position: fixed;
		inset: 0;
		z-index: 500;
		background: rgba(20, 8, 16, 0.82);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		animation: welcomeFadeIn 0.4s ease;
	}

	@keyframes welcomeFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.welcome-card {
		max-width: 520px;
		width: 100%;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 36px 32px 28px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 80px rgba(233, 84, 32, 0.08);
		animation: welcomeCardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
		text-align: center;
	}

	@keyframes welcomeCardIn {
		from { opacity: 0; transform: translateY(20px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.welcome-tags {
		display: flex;
		gap: 6px;
		justify-content: center;
		margin-bottom: 16px;
	}

	.welcome-tag {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent);
		background: var(--accent-soft);
		padding: 3px 10px;
		border-radius: 20px;
	}

	.welcome-heading {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 12px;
		line-height: 1.25;
	}

	.welcome-description {
		font-size: 0.92rem;
		line-height: 1.65;
		color: var(--text-secondary);
		margin-bottom: 24px;
	}

	.welcome-learnings {
		text-align: left;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 10px;
		padding: 14px 18px;
		margin-bottom: 24px;
	}

	.welcome-learnings-label {
		font-family: var(--font-display);
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--orange-300);
		display: block;
		margin-bottom: 8px;
	}

	.welcome-learnings ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.welcome-learnings li {
		font-size: 0.85rem;
		color: var(--text-secondary);
		padding-left: 18px;
		position: relative;
		line-height: 1.5;
	}

	.welcome-learnings li::before {
		content: '\25B8';
		position: absolute;
		left: 0;
		color: var(--accent);
		font-size: 0.75rem;
	}

	.welcome-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}

	.welcome-start {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 600;
		color: #fff;
		background: var(--accent);
		border: none;
		padding: 12px 28px;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 10px var(--accent-glow);
	}

	.welcome-start:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px var(--accent-glow);
	}

	.welcome-start svg {
		width: 16px;
		height: 16px;
		transition: transform 0.2s ease;
	}

	.welcome-start:hover svg {
		transform: translateX(3px);
	}

	.welcome-full-log {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-display);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--border-color);
		padding: 10px 20px;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.welcome-full-log:hover {
		border-color: var(--text-tertiary);
		color: var(--text-primary);
		transform: translateY(-2px);
	}

	.welcome-hint {
		display: block;
		font-size: 0.72rem;
		color: var(--text-tertiary);
		font-family: var(--font-display);
	}

	.welcome-hint--mobile {
		display: none;
	}

	@media (max-width: 900px) {
		.welcome-hint--desktop {
			display: none;
		}
		.welcome-hint--mobile {
			display: block;
		}
	}

	@media (max-width: 480px) {
		.welcome-card {
			padding: 24px 20px 20px;
		}

		.welcome-heading {
			font-size: 1.25rem;
		}

		.welcome-description {
			font-size: 0.85rem;
		}
	}
</style>
