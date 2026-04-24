<!--
	Desktop window stack (right column, top 67%) + maximize overlay.

	Two concerns in one component because they share state (focusedWindow)
	and are both "the windows" part of the desktop metaphor:

	1. `.fiji-area` — the cascading stack of visible windows. `.stack-0`..`.stack-3`
	   set offset/opacity/scale via CSS so the frontmost window is flat and the
	   older ones tilt back. Stack depth is computed by the parent via
	   `getStackClass(idx)` (depends on currentStep).

	2. Maximize overlay — shown when `focusedWindow` is set. Backdrop + a
	   full-workspace-sized window with the same content. Absolute positioning
	   walks up to `.workspace` (the nearest positioned ancestor on the page).

	The chrome's green dot maximizes; the header click jumps the timeline to
	that step (same behavior as the taskbar item).
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { getWindowIcon, isChromeless, type WindowStep, type TutorialMeta, type TutorialWelcome } from '$lib/data/tutorials';
	import { getTutorialTitle } from '$lib/data/tutorials';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { t, langStore } from '$lib/stores/lang.svelte';

	let {
		windowSteps,
		currentStep,
		focusedWindow,
		meta,
		welcome,
		briefing,
		hasFullLog,
		logMode,
		getStackClass,
		onFocus,
		onRestore,
		onJump,
		onSetLogMode
	}: {
		windowSteps: { step: WindowStep; index: number }[];
		currentStep: number;
		focusedWindow: WindowStep | null;
		meta: TutorialMeta;
		welcome?: TutorialWelcome;
		briefing?: { en: string; ja?: string };
		hasFullLog: boolean;
		logMode: 'simplified' | 'full';
		getStackClass: (winIndex: number) => string;
		onFocus: (step: WindowStep) => void;
		onRestore: () => void;
		onJump: (stepIndex: number) => void;
		onSetLogMode: (mode: 'simplified' | 'full') => void;
	} = $props();

	let hasVisibleWindows = $derived(windowSteps.some(w => w.index <= currentStep));

	let descriptionHtml = $state<string | null>(null);
	$effect(() => {
		const text = welcome ? t(welcome.description) : briefing ? t(briefing) : null;
		if (!text) { descriptionHtml = null; return; }
		let cancelled = false;
		renderMarkdown(text).then(html => { if (!cancelled) descriptionHtml = html; });
		return () => { cancelled = true; };
	});

	let title = $derived(getTutorialTitle(meta, langStore.current));
	let thumbnailUrl = $derived(meta.thumbnail ? `${base}/${meta.thumbnail}` : undefined);
	let isVideoThumb = $derived(!!meta.thumbnail && /\.(mp4|mov|webm)$/i.test(meta.thumbnail));
</script>

<div class="fiji-area">
	{#if !hasVisibleWindows}
		<div class="welcome-card-wrap">
			<div class="welcome-card">
				{#if thumbnailUrl}
					<div class="welcome-thumb">
						{#if isVideoThumb}
							<video src={thumbnailUrl} autoplay loop muted playsinline></video>
						{:else}
							<img src={thumbnailUrl} alt={title} />
						{/if}
					</div>
				{/if}
				<div class="welcome-tags">
					{#each meta.tags as tag}
						<span class="welcome-tag">{tag}</span>
					{/each}
				</div>
				<h2 class="welcome-heading">{title}</h2>
				{#if meta.author}
					<p class="welcome-author">by {meta.author}</p>
				{/if}
				{#if welcome}
					<p class="welcome-description">{t(welcome.description)}</p>
					{#if welcome.learnings.length > 0}
						<div class="welcome-learnings">
							<span class="welcome-learnings-label">{t({ en: 'What you’ll see', ja: '学べること' })}</span>
							<ul>
								{#each welcome.learnings as item}
									<li>{t(item)}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{:else if descriptionHtml}
					<div class="welcome-description md">{@html descriptionHtml}</div>
				{/if}
				{#if hasFullLog}
					<div class="welcome-modes">
						<button class="mode-pill" class:active={logMode === 'simplified'} onclick={() => onSetLogMode('simplified')}>
							{t({ en: 'Tutorial', ja: 'チュートリアル' })}
						</button>
						<button class="mode-pill" class:active={logMode === 'full'} onclick={() => onSetLogMode('full')}>
							{t({ en: 'Full Log', ja: '完全ログ' })}
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
	{#each windowSteps as win, idx}
		{@const isFocused = focusedWindow === win.step}
		{@const chromeless = isChromeless(win.step.content)}
		<div
			class="fiji-window window"
			class:chromeless
			class:visible={win.index <= currentStep}
			class:focused-hidden={isFocused}
			class:stack-0={win.index <= currentStep && getStackClass(idx) === 'stack-0'}
			class:stack-1={win.index <= currentStep && getStackClass(idx) === 'stack-1'}
			class:stack-2={win.index <= currentStep && getStackClass(idx) === 'stack-2'}
			class:stack-3={win.index <= currentStep && getStackClass(idx) === 'stack-3'}
		>
			{#if !chromeless}
				<WindowChrome
					title={win.step.windowTitle}
					subtitle={win.step.subtitle}
					icon={win.step.icon ?? getWindowIcon(win.step.content)}
					onMaximize={() => onFocus(win.step)}
					onHeaderClick={() => onJump(win.index)}
				/>
			{/if}
			<WindowContent content={win.step.content} />
		</div>
	{/each}
</div>

{#if focusedWindow}
	{@const chromeless = isChromeless(focusedWindow.content)}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="max-backdrop" onclick={onRestore} role="presentation"></div>
	<div class="window max-window" class:chromeless>
		{#if !chromeless}
			<WindowChrome
				title={focusedWindow.windowTitle}
				subtitle={focusedWindow.subtitle}
				icon={focusedWindow.icon ?? getWindowIcon(focusedWindow.content)}
				isMaximized
				onRestore={onRestore}
			/>
		{/if}
		<div class="max-body">
			<WindowContent content={focusedWindow.content} />
		</div>
	</div>
{/if}

<style>
	/* ─── Fiji window stack ─── */
	.fiji-area {
		flex: 1 1 0;
		position: relative;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* ─── Welcome card (shown until first window appears) ─── */
	.welcome-card-wrap {
		position: absolute;
		inset: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: welcomeIn 0.5s cubic-bezier(0.22, 1, 0.36, 1);
		overflow-y: auto;
	}

	@keyframes welcomeIn {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.welcome-card {
		max-width: 480px;
		width: 100%;
		background: rgba(28, 16, 23, 0.7);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--border-color);
		border-radius: 14px;
		padding: 28px 28px 24px;
		text-align: center;
	}

	.welcome-thumb {
		width: 100%;
		border-radius: 8px;
		overflow: hidden;
		margin-bottom: 16px;
		max-height: 200px;
	}

	.welcome-thumb img,
	.welcome-thumb video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.welcome-tags {
		display: flex;
		gap: 6px;
		justify-content: center;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.welcome-tag {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent);
		background: var(--accent-soft);
		padding: 2px 8px;
		border-radius: 20px;
	}

	.welcome-heading {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 8px;
		line-height: 1.25;
	}

	.welcome-author {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		margin-bottom: 8px;
		font-family: var(--font-display);
	}

	.welcome-description {
		font-size: 0.85rem;
		line-height: 1.6;
		color: var(--text-secondary);
		margin-bottom: 16px;
	}

	.welcome-description.md :global(p) { margin: 0 0 0.6em; }
	.welcome-description.md :global(p:last-child) { margin-bottom: 0; }

	.welcome-learnings {
		text-align: left;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 10px;
		padding: 12px 16px;
		margin-bottom: 16px;
	}

	.welcome-learnings-label {
		font-family: var(--font-display);
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--orange-300);
		display: block;
		margin-bottom: 6px;
	}

	.welcome-learnings ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.welcome-learnings li {
		font-size: 0.8rem;
		color: var(--text-secondary);
		padding-left: 16px;
		position: relative;
		line-height: 1.5;
	}

	.welcome-learnings li::before {
		content: '\25B8';
		position: absolute;
		left: 0;
		color: var(--accent);
		font-size: 0.7rem;
	}

	.welcome-modes {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.mode-pill {
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 500;
		padding: 6px 16px;
		border-radius: 8px;
		border: 1px solid var(--border-color);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mode-pill:hover {
		border-color: var(--text-tertiary);
		color: var(--text-primary);
	}

	.mode-pill.active {
		background: var(--accent-soft);
		border-color: var(--orange-500);
		color: var(--orange-300);
	}

	.fiji-window {
		position: absolute;
		bottom: 8px;
		left: 8px;
		width: auto;
		max-width: min(440px, 85%);
		max-height: calc(100% - 16px);
		transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
		            opacity 0.35s ease-out,
		            filter 0.4s ease-out,
		            box-shadow 0.3s ease-out;
		transform-origin: bottom left;
		opacity: 0;
		transform: translateY(30px) scale(0.9);
		pointer-events: none;
	}

	.fiji-window.visible {
		pointer-events: auto;
	}

	.fiji-window:hover:not(.chromeless) {
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4) !important;
	}

	/* Stack depth — 0 is frontmost (bottom-left), 3 is deepest (toward top-right) */
	.fiji-window.stack-0 {
		opacity: 1;
		transform: translate(0, 0) scale(1);
		z-index: 30;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 3px 10px rgba(0, 0, 0, 0.3);
	}

	.fiji-window.stack-1 {
		opacity: 0.75;
		transform: translate(60px, -30px) scale(0.95);
		z-index: 20;
		filter: brightness(0.8);
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
	}

	.fiji-window.stack-2 {
		opacity: 0.5;
		transform: translate(130px, -55px) scale(0.90);
		z-index: 10;
		filter: brightness(0.65);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
	}

	.fiji-window.stack-3 {
		opacity: 0.3;
		transform: translate(210px, -75px) scale(0.85);
		z-index: 5;
		filter: brightness(0.5);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
	}

	/* Hide the stack entry while its content is shown in the max overlay */
	.fiji-window.focused-hidden {
		opacity: 0 !important;
		pointer-events: none;
	}

	/* Chromeless windows (collections) — invisible container, fills the area */
	.fiji-window.chromeless,
	.max-window.chromeless {
		border: none;
		border-radius: 0;
		box-shadow: none !important;
		background: transparent;
	}

	.fiji-window.chromeless {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		transform-origin: center center;
	}

	.fiji-window.chromeless.stack-0 {
		transform: none;
		box-shadow: none !important;
	}

	.fiji-window.chromeless.stack-1 {
		transform: scale(0.95);
		box-shadow: none !important;
	}

	.fiji-window.chromeless.stack-2 {
		transform: scale(0.90);
		box-shadow: none !important;
	}

	.fiji-window.chromeless.stack-3 {
		transform: scale(0.85);
		box-shadow: none !important;
	}

	/* ─── Maximize overlay ─── */
	/* Positioned absolutely relative to .workspace (the nearest positioned
	   ancestor on the page). This sidesteps right-column layout entirely so
	   the overlay can span the full workspace including the terminal. */
	.max-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 200;
		animation: maxFadeIn 0.18s ease-out;
	}

	@keyframes maxFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.max-window {
		position: absolute;
		inset: 18px 22px;
		z-index: 210;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary);
		animation: maxPopIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes maxPopIn {
		from { opacity: 0; transform: scale(0.97); }
		to { opacity: 1; transform: scale(1); }
	}

	.max-body {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Media inside the max-window should fill the available space */
	.max-body :global(.zoom-container) {
		flex: 1 1 auto;
		min-height: 0;
	}

	.max-body :global(.zoom-content) {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.max-body :global(img),
	.max-body :global(video) {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	.max-body :global(.markdown-body),
	.max-body :global(.source-body),
	.max-body :global(.folder-body) {
		flex: 1 1 auto;
		max-height: none;
	}

	@media (max-width: 900px) {
		.fiji-area { display: none; }
	}
</style>
