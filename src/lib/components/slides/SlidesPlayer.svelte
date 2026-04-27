<script lang="ts">
	import type { Tutorial, Step, WindowStep, AssistantStep, TutorialRound } from '$lib/data/tutorials';
	import { getTutorialTitle, getWindowIcon, isChromeless } from '$lib/data/tutorials';
	import { langStore } from '$lib/stores/lang.svelte';
	import { themeStore, THEMES } from '$lib/stores/theme.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import Wallpaper from '$lib/components/Wallpaper.svelte';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import { computeStackStyle } from '$lib/components/windows/stack-constants';
	import SlidesProgress from './SlidesProgress.svelte';
	import SlidesStep from './SlidesStep.svelte';

	let { tutorial }: { tutorial: Tutorial } = $props();

	const PROMPT_DURATION = 1500;
	const MESSAGE_DURATION = 2000;
	const WINDOW_DURATION = 2000;
	const ANSWER_DURATION = 5000;
	const TITLE_DURATION = 3000;
	const SCENE_GAP = 1200;
	const SWIPE_THRESHOLD = 50;

	/* ─── Scene model ────────────────────────── */

	interface SceneItem {
		kind: 'prompt' | 'message' | 'window' | 'answer';
		round: TutorialRound;
		step?: Step;
		duration: number;
	}

	let scenes: SceneItem[][] = $derived.by(() => {
		const result: SceneItem[][] = [];
		for (const round of tutorial.rounds) {
			const items: SceneItem[] = [];
			items.push({ kind: 'prompt', round, duration: PROMPT_DURATION });
			for (const step of round.steps) {
				if (step.hidden) continue;
				if (step.type === 'assistant' && !(step as AssistantStep).final) {
					items.push({ kind: 'message', round, step, duration: step.slideDuration ?? MESSAGE_DURATION });
				} else if (step.type === 'window') {
					items.push({ kind: 'window', round, step, duration: step.slideDuration ?? WINDOW_DURATION });
				} else if (step.type === 'assistant' && (step as AssistantStep).final) {
					items.push({ kind: 'answer', round, step, duration: step.slideDuration ?? ANSWER_DURATION });
				} else if (step.slideDuration && step.slideDuration > 0) {
					items.push({ kind: 'message', round, step, duration: step.slideDuration });
				}
			}
			result.push(items);
		}
		return result;
	});

	let totalItems = $derived(scenes.reduce((sum, s) => sum + s.length, 0));

	/* ─── Playback state ─────────────────────── */

	let phase = $state<'title' | 'playing' | 'done'>('title');
	let currentScene = $state(0);
	let currentItemInScene = $state(-1);
	let paused = $state(false);
	let itemsShown = $state(0);
	let showHotkeys = $state(false);
	let timerId: ReturnType<typeof setTimeout> | null = null;

	let progress = $derived(
		phase === 'title' ? 0
		: phase === 'done' ? 1
		: totalItems > 0 ? itemsShown / totalItems : 0
	);

	let activePrompt = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return null;
		if (currentItemInScene < 0) return null;
		return scenes[currentScene][0]?.kind === 'prompt' ? scenes[currentScene][0] : null;
	});

	let activeWindows = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return [];
		const items = scenes[currentScene];
		const wins: WindowStep[] = [];
		for (let i = 0; i <= currentItemInScene && i < items.length; i++) {
			if (items[i].kind === 'window' && items[i].step) wins.push(items[i].step as WindowStep);
		}
		return wins;
	});

	let activeMessages = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return [];
		const items = scenes[currentScene];
		const msgs: Step[] = [];
		for (let i = 0; i <= currentItemInScene && i < items.length; i++) {
			if (items[i].kind === 'message' && items[i].step) msgs.push(items[i].step!);
		}
		return msgs;
	});

	let activeAnswer = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return null;
		const items = scenes[currentScene];
		for (let i = 0; i <= currentItemInScene && i < items.length; i++) {
			if (items[i].kind === 'answer' && items[i].step) return items[i].step as AssistantStep;
		}
		return null;
	});

	function stepToHtml(step: Step): string {
		if ('html' in step && step.html) return step.html as string;
		if (step.type === 'tool_call') return `<p><strong>${(step as import('$lib/data/tutorials').ToolCallStep).toolName}</strong></p><pre>${(step as import('$lib/data/tutorials').ToolCallStep).code}</pre>`;
		if (step.type === 'tool_result') return `<pre>${(step as import('$lib/data/tutorials').ToolResultStep).text}</pre>`;
		if (step.type === 'thinking') return `<p><em>${(step as import('$lib/data/tutorials').ThinkingStep).text.slice(0, 200)}${(step as import('$lib/data/tutorials').ThinkingStep).text.length > 200 ? '…' : ''}</em></p>`;
		if (step.type === 'output') return `<pre>${(step as import('$lib/data/tutorials').OutputStep).text}</pre>`;
		if (step.type === 'status') return `<p>${(step as import('$lib/data/tutorials').StatusStep).text}</p>`;
		if (step.type === 'permission') return `<p><strong>${(step as import('$lib/data/tutorials').PermissionStep).tool}</strong>: ${(step as import('$lib/data/tutorials').PermissionStep).description}</p>`;
		return `<p>[${step.type}]</p>`;
	}

	function windowStackStyle(index: number, total: number): string {
		const depth = total - 1 - index;
		if (depth === 0) return 'opacity:1;transform:translate(-50%,-50%) scale(1);z-index:30;';
		const s = computeStackStyle(depth);
		return `opacity:${s.opacity};transform:translate(calc(-50% + ${s.tx}px),calc(-50% + ${s.ty}px)) scale(${s.scale});filter:brightness(${s.brightness});z-index:${s.z};`;
	}

	/* ─── Playback engine ────────────────────── */

	function clearTimer() { if (timerId) { clearTimeout(timerId); timerId = null; } }

	function advance() {
		if (paused) return;
		const items = scenes[currentScene];
		if (!items) { phase = 'done'; return; }
		currentItemInScene++;
		itemsShown++;
		if (currentItemInScene >= items.length) {
			currentScene++;
			currentItemInScene = -1;
			if (currentScene >= scenes.length) { phase = 'done'; return; }
			timerId = setTimeout(advance, SCENE_GAP);
			return;
		}
		timerId = setTimeout(advance, items[currentItemInScene].duration);
	}

	function stepForward() {
		clearTimer();
		if (phase === 'title') { startPlayback(); return; }
		if (phase === 'done') return;
		const items = scenes[currentScene];
		if (currentItemInScene + 1 >= items.length) {
			currentScene++;
			currentItemInScene = -1;
			itemsShown++;
			if (currentScene >= scenes.length) { phase = 'done'; return; }
			currentItemInScene = 0;
			itemsShown++;
		} else {
			currentItemInScene++;
			itemsShown++;
		}
		if (!paused) {
			const item = scenes[currentScene]?.[currentItemInScene];
			if (item) timerId = setTimeout(advance, item.duration);
		}
	}

	function stepBack() {
		clearTimer();
		if (phase === 'done') {
			phase = 'playing';
			currentScene = scenes.length - 1;
			currentItemInScene = scenes[currentScene].length - 1;
			itemsShown = Math.max(0, itemsShown - 1);
			return;
		}
		if (phase === 'title') return;
		if (currentItemInScene > 0) {
			currentItemInScene--;
			itemsShown = Math.max(0, itemsShown - 1);
		} else if (currentScene > 0) {
			currentScene--;
			currentItemInScene = scenes[currentScene].length - 1;
			itemsShown = Math.max(0, itemsShown - 1);
		}
		if (!paused) {
			const item = scenes[currentScene]?.[currentItemInScene];
			if (item) timerId = setTimeout(advance, item.duration);
		}
	}

	function resetPlayback() {
		clearTimer();
		phase = 'title';
		currentScene = 0;
		currentItemInScene = -1;
		itemsShown = 0;
		paused = false;
		timerId = setTimeout(startPlayback, TITLE_DURATION);
	}

	function startPlayback() {
		phase = 'playing';
		currentScene = 0;
		currentItemInScene = -1;
		itemsShown = 0;
		advance();
	}

	function togglePause() {
		if (phase === 'title') { startPlayback(); return; }
		if (phase === 'done') return;
		paused = !paused;
		if (paused) clearTimer();
		else advance();
	}

	function exitSlides() { clearTimer(); goto(`${base}/tutorials/${tutorial.meta.slug}`); }

	function cycleTheme() {
		const idx = THEMES.findIndex(t => t.id === themeStore.theme);
		themeStore.theme = THEMES[(idx + 1) % THEMES.length].id;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.code === 'Escape') { e.preventDefault(); exitSlides(); return; }
		if (e.code === 'Space') { e.preventDefault(); togglePause(); }
		if (e.code === 'KeyP' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); togglePause(); }
		if (e.code === 'ArrowRight') { e.preventDefault(); stepForward(); }
		if (e.code === 'ArrowLeft') { e.preventDefault(); stepBack(); }
		if (e.code === 'KeyT' && !e.metaKey && !e.ctrlKey) cycleTheme();
		if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) resetPlayback();
		if (e.code === 'Slash' && !e.metaKey && !e.ctrlKey) { showHotkeys = !showHotkeys; }
	}

	/* ─── Touch / swipe ─────────────────────── */

	let touchStartX = 0;
	let touchStartY = 0;
	function handleTouchStart(e: TouchEvent) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
	function handleTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
		if (dx < 0) stepForward(); else stepBack();
	}

	onMount(() => { timerId = setTimeout(startPlayback, TITLE_DURATION); });
	onDestroy(() => { clearTimer(); });

	let title = $derived(getTutorialTitle(tutorial.meta, langStore.current));
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="slides-root" ontouchstart={handleTouchStart} ontouchend={handleTouchEnd}>
	<Wallpaper />
	<SlidesProgress {progress} />

	<!-- Top-right controls -->
	<div class="slides-controls">
		<button class="slides-ctrl-btn" title="Keyboard shortcuts" onclick={() => (showHotkeys = !showHotkeys)}>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="4" width="20" height="16" rx="2" />
				<path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h8" />
			</svg>
		</button>
		<button class="slides-ctrl-btn" title="Exit slides (Esc)" onclick={exitSlides}>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<!-- Hotkeys overlay -->
	{#if showHotkeys}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="hotkeys-overlay" onclick={() => (showHotkeys = false)}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="hotkeys" onclick={(e) => e.stopPropagation()}>
				<h3>Keyboard Shortcuts</h3>
				<dl>
					<dt><kbd>Space</kbd> / <kbd>P</kbd></dt><dd>Play / Pause</dd>
					<dt><kbd>→</kbd></dt><dd>Next step</dd>
					<dt><kbd>←</kbd></dt><dd>Previous step</dd>
					<dt><kbd>R</kbd></dt><dd>Restart</dd>
					<dt><kbd>T</kbd></dt><dd>Cycle theme</dd>
					<dt><kbd>Esc</kbd></dt><dd>Exit slides</dd>
					<dt><kbd>/</kbd></dt><dd>Toggle this help</dd>
				</dl>
				<p class="hotkeys__hint">Swipe left/right on touch devices</p>
				<button class="hotkeys__close" onclick={() => (showHotkeys = false)}>Got it</button>
			</div>
		</div>
	{/if}

	<!-- Title card -->
	{#if phase === 'title'}
		<div class="title-card">
			<h1 class="title-card__heading">{title}</h1>
			{#if tutorial.description}
				<p class="title-card__sub">{tutorial.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Main layout: left chat + right content -->
	{#if phase === 'playing' || phase === 'done'}
		<div class="layout">
			<!-- Left: chat frame -->
			<div class="chat-frame">
				<div class="chat-frame__inner">
					{#if activePrompt}
						{#key `${currentScene}-prompt`}
							<SlidesStep kind="prompt">
								<div class="bubble bubble--user">
									<span class="bubble__tag">You</span>
									<span class="bubble__text">{activePrompt.round.prompt}</span>
								</div>
							</SlidesStep>
						{/key}
					{/if}

					{#each activeMessages as msg, mi (mi + '-' + currentScene)}
						<SlidesStep kind="step">
							<div class="bubble bubble--ai bubble--brief">
								<div class="bubble__html">{@html stepToHtml(msg)}</div>
							</div>
						</SlidesStep>
					{/each}

					{#if activeAnswer}
						{#key `${currentScene}-answer`}
							<SlidesStep kind="final">
								<div class="bubble bubble--ai">
									<span class="bubble__tag">AI Agent</span>
									<div class="bubble__html">{@html activeAnswer.html}</div>
								</div>
							</SlidesStep>
						{/key}
					{/if}
				</div>
			</div>

			<!-- Right: window content -->
			<div class="content-area">
				{#if activeWindows.length > 0}
					{#each activeWindows as win, wi (wi + '-' + currentScene)}
						<div class="stack-window" style={windowStackStyle(wi, activeWindows.length)}>
							<div class="window" class:window--collection={win.content.kind === 'window-collection'}>
								{#if !isChromeless(win.content)}
									<WindowChrome
										title={win.windowTitle}
										subtitle={win.subtitle}
										icon={win.icon ?? getWindowIcon(win.content)}
									/>
								{/if}
								<div class="window__content">
									<WindowContent content={win.content} />
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	{#if paused}
		<div class="pause-badge">PAUSED</div>
	{/if}
</div>

<style>
	.slides-root {
		position: fixed;
		inset: 0;
		overflow: hidden;
		font-family: var(--font-display);
		touch-action: pan-y;
	}

	/* ─── Controls ─── */
	.slides-controls {
		position: fixed;
		top: 12px;
		right: 12px;
		z-index: 200;
		display: flex;
		gap: 6px;
		opacity: 0;
		transition: opacity 0.25s;
	}
	.slides-root:hover .slides-controls,
	.slides-controls:focus-within { opacity: 1; }
	@media (pointer: coarse) { .slides-controls { opacity: 0.6; } }

	.slides-ctrl-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.45);
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		backdrop-filter: blur(8px);
		transition: background 0.15s, color 0.15s;
	}
	.slides-ctrl-btn:hover {
		background: rgba(0, 0, 0, 0.65);
		color: white;
	}

	/* ─── Hotkeys ─── */
	.hotkeys-overlay {
		position: fixed;
		inset: 0;
		z-index: 300;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		animation: fadeIn 0.15s ease-out;
	}
	.hotkeys {
		background: var(--bg-secondary, #1a1020);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		padding: 28px 32px;
		max-width: 380px;
		width: 90%;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
	}
	.hotkeys h3 { margin: 0 0 16px; font-size: 1rem; font-weight: 700; color: var(--text-primary); }
	.hotkeys dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; align-items: baseline; }
	.hotkeys dt { text-align: right; white-space: nowrap; }
	.hotkeys dd { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }
	.hotkeys kbd {
		display: inline-block;
		padding: 2px 7px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-primary);
	}
	.hotkeys__hint { margin: 14px 0 0; font-size: 0.78rem; color: var(--text-tertiary); font-style: italic; }
	.hotkeys__close {
		display: block;
		margin: 16px auto 0;
		padding: 6px 20px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
		font-size: 0.82rem;
		cursor: pointer;
		transition: all 0.15s;
	}
	.hotkeys__close:hover { background: rgba(255, 255, 255, 0.12); color: var(--text-primary); }

	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

	/* ─── Title card ─── */
	.title-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		padding: 0 48px;
		animation: titleIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	.title-card__heading {
		font-size: 2.8rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}
	.title-card__sub {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin-top: 16px;
		max-width: 600px;
		line-height: 1.5;
	}
	@keyframes titleIn {
		from { opacity: 0; transform: translateY(24px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ════════════════════════════════════════════
	   Main layout: left chat + right content
	   ════════════════════════════════════════════ */

	.layout {
		position: relative;
		z-index: 1;
		display: flex;
		height: 100vh;
	}

	/* ─── Left: chat frame ─── */
	.chat-frame {
		width: 40%;
		flex-shrink: 0;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px 24px 32px 40px;
	}

	.chat-frame__inner {
		width: 100%;
		max-width: 480px;
		height: 520px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 12px;
		padding: 24px;
		border-radius: 16px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(10px);
		overflow-y: auto;
	}

	/* ─── Bubbles ─── */

	.bubble {
		padding: 14px 18px;
		border-radius: 14px;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text-primary);
	}

	.bubble__tag {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-bottom: 4px;
		opacity: 0.7;
	}

	.bubble__text {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.bubble__html :global(p) { margin: 0 0 8px; }
	.bubble__html :global(p:last-child) { margin-bottom: 0; }
	.bubble__html :global(strong) { color: var(--text-primary); }

	.bubble--user {
		align-self: flex-end;
		margin-left: 32px;
		background: rgba(233, 84, 32, 0.25);
		border: 1px solid rgba(233, 84, 32, 0.35);
		border-radius: 14px 14px 4px 14px;
		text-align: right;
	}
	.bubble--user .bubble__tag { color: var(--orange-400, #E95420); }

	.bubble--ai {
		align-self: flex-start;
		margin-right: 32px;
		background: rgba(42, 161, 152, 0.22);
		border: 1px solid rgba(42, 161, 152, 0.3);
		border-radius: 14px 14px 14px 4px;
	}
	.bubble--ai .bubble__tag { color: var(--teal, #2AA198); }

	.bubble--brief {
		padding: 10px 14px;
		font-size: 0.85rem;
		opacity: 0.85;
	}

	/* ─── Right: content area ─── */
	.content-area {
		flex: 1;
		height: 100vh;
		position: relative;
	}

	.stack-window {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 88%;
		max-width: 780px;
		transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
		            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
		            filter 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.window {
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg-primary);
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.window__content {
		max-height: 65vh;
		overflow: hidden;
	}

	.window--collection {
		background: transparent;
		box-shadow: none;
		border-radius: 0;
		border: none;
	}

	.window--collection .window__content :global(.sub-window) {
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		background: var(--bg-secondary);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
	}

	.window--collection .window__content :global(.collection-grid) {
		gap: 4px;
	}

	/* ─── Pause ─── */
	.pause-badge {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 100;
		padding: 6px 14px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.6);
		color: var(--text-secondary);
		font-size: 0.7rem;
		font-family: var(--font-mono);
		letter-spacing: 0.15em;
		backdrop-filter: blur(8px);
	}
</style>
