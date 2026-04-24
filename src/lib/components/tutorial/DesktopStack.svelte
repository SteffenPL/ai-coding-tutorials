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
	import { getWindowIcon, isChromeless, type WindowStep, type TutorialMeta } from '$lib/data/tutorials';
	import { getTutorialTitle } from '$lib/data/tutorials';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { langStore } from '$lib/stores/lang.svelte';

	let {
		windowSteps,
		currentStep,
		focusedWindow,
		meta,
		description,
		requirements,
		getStackDepth,
		getEnterDelay,
		onFocus,
		onRestore,
		onJump
	}: {
		windowSteps: { step: WindowStep; index: number }[];
		currentStep: number;
		focusedWindow: WindowStep | null;
		meta: TutorialMeta;
		description?: string;
		requirements?: string;
		getStackDepth: (winIndex: number) => number;
		getEnterDelay: (winIndex: number) => number;
		onFocus: (step: WindowStep) => void;
		onRestore: () => void;
		onJump: (stepIndex: number) => void;
	} = $props();

	function stackStyle(depth: number, chromeless: boolean): string {
		if (depth < 0) {
			return 'opacity:0;transform:translateY(6px) scale(0.98);pointer-events:none';
		}
		if (chromeless) {
			const tx = depth * 50;
			const ty = depth * -22;
			const scale = Math.max(0.7, 1 - depth * 0.04);
			const brightness = Math.max(0.35, 1 - depth * 0.12);
			const opacity = Math.max(0.1, 1 - depth * 0.18);
			const z = Math.max(2, 30 - depth * 5);
			return `opacity:${opacity};transform:translate(${tx}px,${ty}px) scale(${scale});filter:brightness(${brightness});z-index:${z};pointer-events:auto`;
		}
		const tx = depth * 50;
		const ty = depth * -22;
		const scale = Math.max(0.7, 1 - depth * 0.04);
		const opacity = Math.max(0.1, 1 - depth * 0.18);
		const brightness = Math.max(0.35, 1 - depth * 0.12);
		const z = Math.max(2, 30 - depth * 5);
		return `opacity:${opacity};transform:translate(${tx}px,${ty}px) scale(${scale});filter:brightness(${brightness});z-index:${z};pointer-events:auto;box-shadow:var(--shadow-window-1)`;
	}

	let hasVisibleWindows = $derived(windowSteps.some(w => w.index <= currentStep));

	let descriptionHtml = $state<string | null>(null);
	$effect(() => {
		if (!description) { descriptionHtml = null; return; }
		let cancelled = false;
		renderMarkdown(description).then(html => { if (!cancelled) descriptionHtml = html; });
		return () => { cancelled = true; };
	});

	let requirementsHtml = $state<string | null>(null);
	$effect(() => {
		if (!requirements) { requirementsHtml = null; return; }
		let cancelled = false;
		renderMarkdown(requirements).then(html => { if (!cancelled) requirementsHtml = html; });
		return () => { cancelled = true; };
	});

	let title = $derived(getTutorialTitle(meta, langStore.current));
</script>

<div class="fiji-area">
	{#if !hasVisibleWindows}
		<div class="welcome-card-wrap">
			<div class="welcome-card">
				<div class="welcome-tags">
					{#each meta.tags as tag}
						<span class="welcome-tag">{tag}</span>
					{/each}
				</div>
				<h2 class="welcome-heading">{title}</h2>
				{#if meta.author}
					<p class="welcome-author">by {meta.author}</p>
				{/if}
				{#if descriptionHtml}
					<div class="welcome-description md">{@html descriptionHtml}</div>
				{/if}
				{#if requirementsHtml}
					<div class="welcome-requirements md">{@html requirementsHtml}</div>
				{/if}
			</div>
		</div>
	{/if}
	{#each windowSteps as win, idx}
		{@const isFocused = focusedWindow === win.step}
		{@const chromeless = isChromeless(win.step.content)}
		{@const enterDelay = getEnterDelay(idx)}
		{@const depth = win.index <= currentStep ? getStackDepth(idx) : -1}
		<div
			class="fiji-window window"
			class:chromeless
			class:focused-hidden={isFocused}
			style="{stackStyle(depth, chromeless)};--enter-delay:{enterDelay}ms"
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
		overflow: hidden;
	}

	@keyframes welcomeIn {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.welcome-card {
		max-width: 480px;
		max-height: 100%;
		width: 100%;
		background: var(--glass-bg-soft);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--border-color);
		border-radius: 14px;
		padding: 28px 28px 24px;
		text-align: left;
		overflow-y: auto;
	}

	.welcome-tags {
		display: flex;
		gap: 6px;
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
	.welcome-description.md :global(h1),
	.welcome-description.md :global(h2),
	.welcome-description.md :global(h3) {
		font-family: var(--font-display);
		font-weight: 600;
		margin: 0.8em 0 0.4em;
		line-height: 1.3;
	}
	.welcome-description.md :global(h1:first-child),
	.welcome-description.md :global(h2:first-child),
	.welcome-description.md :global(h3:first-child) { margin-top: 0; }
	.welcome-description.md :global(h1) { font-size: 1.1rem; color: var(--orange-300); }
	.welcome-description.md :global(h2) { font-size: 0.95rem; color: var(--orange-300); }
	.welcome-description.md :global(h3) { font-size: 0.85rem; color: var(--orange-300); }
	.welcome-description.md :global(strong) { color: var(--text-primary); }
	.welcome-description.md :global(ul),
	.welcome-description.md :global(ol) { margin: 0 0 0.6em; padding-left: 1.3em; }
	.welcome-description.md :global(li) { margin-bottom: 0.2em; }
	.welcome-description.md :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		padding: 0.05em 0.35em;
		background: var(--overlay-light);
		border-radius: 3px;
		color: var(--peach);
	}

	.welcome-requirements {
		text-align: left;
		background: var(--overlay-subtle);
		border-radius: 10px;
		padding: 12px 16px;
		font-size: 0.82rem;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.welcome-requirements :global(p) { margin: 0 0 0.5em; }
	.welcome-requirements :global(p:last-child) { margin-bottom: 0; }
	.welcome-requirements :global(strong) { color: var(--text-primary); }
	.welcome-requirements :global(ul),
	.welcome-requirements :global(ol) { margin: 0 0 0.5em; padding-left: 1.2em; }
	.welcome-requirements :global(li) { margin-bottom: 0.2em; }

	.fiji-window {
		position: absolute;
		bottom: 8px;
		left: 8px;
		width: auto;
		max-width: min(440px, 85%);
		max-height: calc(100% - 16px);
		--enter-delay: 0ms;
		transition: transform 50ms ease-out var(--enter-delay),
		            opacity 50ms ease-out var(--enter-delay),
		            filter 50ms ease-out var(--enter-delay),
		            box-shadow 50ms ease-out var(--enter-delay);
		transform-origin: center left;
	}

	.fiji-window:hover:not(.chromeless) {
		box-shadow: var(--shadow-window-0) !important;
	}

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

	/* ─── Maximize overlay ─── */
	/* Positioned absolutely relative to .workspace (the nearest positioned
	   ancestor on the page). This sidesteps right-column layout entirely so
	   the overlay can span the full workspace including the terminal. */
	.max-backdrop {
		position: absolute;
		inset: 0;
		background: var(--overlay-bg);
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
