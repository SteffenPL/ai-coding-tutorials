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
	import { getWindowIcon, isChromeless, type WindowStep } from '$lib/data/tutorials';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { t } from '$lib/stores/lang.svelte';

	let {
		windowSteps,
		currentStep,
		focusedWindow,
		briefing,
		getStackClass,
		onFocus,
		onRestore,
		onJump
	}: {
		windowSteps: { step: WindowStep; index: number }[];
		currentStep: number;
		focusedWindow: WindowStep | null;
		briefing?: { en: string; ja?: string };
		getStackClass: (winIndex: number) => string;
		onFocus: (step: WindowStep) => void;
		onRestore: () => void;
		onJump: (stepIndex: number) => void;
	} = $props();

	let hasVisibleWindows = $derived(windowSteps.some(w => w.index <= currentStep));
	let showBriefing = $derived(!!briefing && !hasVisibleWindows);

	let briefingHtml = $state<string | null>(null);
	$effect(() => {
		if (!briefing) { briefingHtml = null; return; }
		const text = t(briefing);
		let cancelled = false;
		renderMarkdown(text).then(html => { if (!cancelled) briefingHtml = html; });
		return () => { cancelled = true; };
	});
</script>

<div class="fiji-area">
	{#if !hasVisibleWindows}
		{#if showBriefing && briefingHtml}
			<div class="briefing">
				<div class="briefing-inner md">{@html briefingHtml}</div>
			</div>
		{:else}
			<div class="empty-state">
				<svg class="empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="6" y="10" width="36" height="28" rx="3" />
					<line x1="6" y1="17" x2="42" y2="17" />
					<circle cx="11" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
					<circle cx="15.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
					<circle cx="20" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
				</svg>
				<span class="empty-label">Content area</span>
				<span class="empty-sub">Windows appear here as the session progresses</span>
			</div>
		{/if}
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

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		opacity: 0.35;
		transition: opacity 0.4s ease-out;
		pointer-events: none;
		user-select: none;
	}

	.empty-icon {
		width: 56px;
		height: 56px;
		color: var(--aubergine-300);
	}

	.empty-label {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--aubergine-300);
	}

	.empty-sub {
		font-family: var(--font-display);
		font-size: 11px;
		color: var(--aubergine-400);
		text-align: center;
		max-width: 200px;
		line-height: 1.4;
	}

	/* ─── Briefing (empty-state markdown) ─── */
	.briefing {
		position: absolute;
		inset: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		animation: briefingFadeIn 0.4s ease-out;
	}

	@keyframes briefingFadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.briefing-inner {
		max-width: 520px;
		padding: 32px 36px;
		background: rgba(28, 16, 23, 0.7);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		font-family: var(--font-display);
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
		pointer-events: auto;
		overflow-y: auto;
		max-height: 100%;
	}

	.briefing-inner :global(h1),
	.briefing-inner :global(h2),
	.briefing-inner :global(h3) {
		color: var(--text-primary);
		font-family: var(--font-display);
		font-weight: 600;
		margin: 1em 0 0.5em;
		line-height: 1.3;
	}
	.briefing-inner :global(h1:first-child),
	.briefing-inner :global(h2:first-child),
	.briefing-inner :global(h3:first-child) { margin-top: 0; }
	.briefing-inner :global(h1) { font-size: 1.4rem; }
	.briefing-inner :global(h2) { font-size: 1.15rem; }
	.briefing-inner :global(h3) { font-size: 1rem; color: var(--peach); }

	.briefing-inner :global(p) { margin: 0 0 0.8em; }
	.briefing-inner :global(strong) { color: var(--text-primary); }
	.briefing-inner :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9em;
		padding: 0.08em 0.4em;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--peach);
	}

	.briefing-inner :global(ul),
	.briefing-inner :global(ol) {
		margin: 0 0 0.8em;
		padding-left: 1.4em;
	}

	.fiji-window {
		position: absolute;
		bottom: 8px;
		left: 8px;
		width: min(440px, 85%);
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

	.fiji-window:hover {
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

	/* Chromeless windows (collections) fill the entire area */
	.fiji-window.chromeless {
		width: calc(100% - 16px);
		height: calc(100% - 16px);
		border-radius: 0;
		box-shadow: none;
		background: transparent;
	}

	.max-window.chromeless {
		border-radius: 0;
		background: transparent;
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
