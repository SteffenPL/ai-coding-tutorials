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
	import SlidesProgress from './SlidesProgress.svelte';
	import SlidesStep from './SlidesStep.svelte';

	let { tutorial }: { tutorial: Tutorial } = $props();

	const PROMPT_DURATION = 1500;
	const WINDOW_DURATION = 2000;
	const ANSWER_DURATION = 5000;
	const TITLE_DURATION = 3000;
	const SCENE_GAP = 1200;
	const SWIPE_THRESHOLD = 50;

	/* ─── Scene model ────────────────────────── */

	interface SceneItem {
		kind: 'prompt' | 'window' | 'answer';
		round: TutorialRound;
		step?: Step;
		duration: number;
	}

	let scenes: SceneItem[][] = $derived.by(() => {
		const result: SceneItem[][] = [];
		for (const round of tutorial.rounds) {
			const items: SceneItem[] = [];
			items.push({
				kind: 'prompt',
				round,
				duration: PROMPT_DURATION
			});
			for (const step of round.steps) {
				if (step.hidden) continue;
				if (step.type === 'window') {
					items.push({
						kind: 'window',
						round,
						step,
						duration: step.slideDuration ?? WINDOW_DURATION
					});
				} else if (step.type === 'assistant' && (step as AssistantStep).final) {
					items.push({
						kind: 'answer',
						round,
						step,
						duration: step.slideDuration ?? ANSWER_DURATION
					});
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
		const items = scenes[currentScene];
		if (currentItemInScene < 0) return null;
		return items[0]?.kind === 'prompt' ? items[0] : null;
	});

	let activeWindows = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return [];
		const items = scenes[currentScene];
		const wins: WindowStep[] = [];
		for (let i = 0; i <= currentItemInScene && i < items.length; i++) {
			if (items[i].kind === 'window' && items[i].step) {
				wins.push(items[i].step as WindowStep);
			}
		}
		return wins;
	});

	let activeAnswer = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return null;
		const items = scenes[currentScene];
		for (let i = 0; i <= currentItemInScene && i < items.length; i++) {
			if (items[i].kind === 'answer' && items[i].step) return items[i].step as AssistantStep;
		}
		return null;
	});

	let activeComment = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return null;
		const items = scenes[currentScene];
		for (let i = currentItemInScene; i >= 0 && i < items.length; i--) {
			const step = items[i].step;
			if (step?.comment) {
				const c = step.comment;
				if (typeof c === 'string') return c;
				return langStore.current === 'ja' && c.ja ? c.ja : c.en;
			}
		}
		return null;
	});

	let sceneHasWindows = $derived.by(() => {
		if (phase !== 'playing' || currentScene >= scenes.length) return false;
		return scenes[currentScene].some(item => item.kind === 'window');
	});

	function windowStackStyle(index: number, total: number): string {
		const depth = total - 1 - index;
		if (depth === 0) {
			return 'opacity:1;transform:translate(-50%,-50%) scale(1);z-index:30;';
		}
		const tx = depth * 40;
		const ty = depth * -18;
		const scale = Math.max(0.75, 1 - depth * 0.04);
		const opacity = Math.max(0.15, 1 - depth * 0.25);
		const brightness = Math.max(0.4, 1 - depth * 0.15);
		const z = Math.max(2, 30 - depth * 5);
		return `opacity:${opacity};transform:translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(${scale});filter:brightness(${brightness});z-index:${z};`;
	}

	/* ─── Playback engine ────────────────────── */

	function clearTimer() {
		if (timerId) { clearTimeout(timerId); timerId = null; }
	}

	function advance() {
		if (paused) return;
		const items = scenes[currentScene];
		if (!items) { phase = 'done'; return; }

		currentItemInScene++;
		itemsShown++;

		if (currentItemInScene >= items.length) {
			currentScene++;
			currentItemInScene = -1;
			if (currentScene >= scenes.length) {
				phase = 'done';
				return;
			}
			timerId = setTimeout(advance, SCENE_GAP);
			return;
		}

		const item = items[currentItemInScene];
		timerId = setTimeout(advance, item.duration);
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
		if (paused) {
			clearTimer();
		} else {
			advance();
		}
	}

	function exitSlides() {
		clearTimer();
		goto(`${base}/tutorials/${tutorial.meta.slug}`);
	}

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

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
		if (dx < 0) stepForward();
		else stepBack();
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

	<!-- Top-right controls (visible on hover / touch) -->
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
		<div class="slides-hotkeys-overlay" onclick={() => (showHotkeys = false)}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="slides-hotkeys" onclick={(e) => e.stopPropagation()}>
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
				<p class="slides-hotkeys__swipe">On touch devices: swipe left/right to navigate</p>
				<button class="slides-hotkeys__close" onclick={() => (showHotkeys = false)}>Got it</button>
			</div>
		</div>
	{/if}

	<!-- Title card -->
	{#if phase === 'title'}
		<div class="slides-title-card">
			<h1 class="slides-title">{title}</h1>
			{#if tutorial.description}
				<p class="slides-subtitle">{tutorial.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Playing / done -->
	{#if phase === 'playing' || phase === 'done'}
		{#if sceneHasWindows}
			<!-- ═══ ACTION LAYOUT: windows take center stage ═══ -->
			<div class="action-layout">
				<div class="action-top">
					{#if activePrompt}
						{#key `${currentScene}-prompt`}
							<SlidesStep kind="prompt">
								<div class="bubble bubble--user bubble--compact">
									<span class="bubble__sender">You</span>
									<span class="bubble__text">{activePrompt.round.prompt}</span>
								</div>
							</SlidesStep>
						{/key}
					{/if}
				</div>

				<div class="action-center">
					{#if activeWindows.length > 0}
						{#each activeWindows as win, wi (wi + '-' + currentScene)}
							<div
								class="slides-stack-window"
								style={windowStackStyle(wi, activeWindows.length)}
							>
								<div class="slides-window">
									{#if !isChromeless(win.content)}
										<WindowChrome
											title={win.windowTitle}
											subtitle={win.subtitle}
											icon={win.icon ?? getWindowIcon(win.content)}
										/>
									{/if}
									<div class="slides-window__content">
										<WindowContent content={win.content} />
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<div class="action-bottom">
					{#if activeAnswer}
						{#key `${currentScene}-answer`}
							<SlidesStep kind="final">
								<div class="bubble bubble--ai">
									<span class="bubble__sender">AI</span>
									<div class="bubble__html">{@html activeAnswer.html}</div>
								</div>
							</SlidesStep>
						{/key}
					{/if}
					{#if activeComment && !activeAnswer}
						{#key activeComment}
							<div class="action-comment">{@html activeComment}</div>
						{/key}
					{/if}
				</div>
			</div>
		{:else}
			<!-- ═══ CHAT LAYOUT: prompt + answer conversation ═══ -->
			<div class="chat-layout">
				<div class="chat-thread">
					{#if activePrompt}
						{#key `${currentScene}-prompt`}
							<SlidesStep kind="prompt">
								<div class="bubble bubble--user">
									<span class="bubble__sender">You</span>
									<div class="bubble__text">{activePrompt.round.prompt}</div>
								</div>
							</SlidesStep>
						{/key}
					{/if}

					{#if activeAnswer}
						{#key `${currentScene}-answer`}
							<SlidesStep kind="final">
								<div class="bubble bubble--ai">
									<span class="bubble__sender">AI Agent</span>
									<div class="bubble__html">{@html activeAnswer.html}</div>
								</div>
							</SlidesStep>
						{/key}
					{/if}
				</div>

				{#if activeComment}
					{#key activeComment}
						<div class="chat-comment">
							<div class="chat-comment__bubble">{@html activeComment}</div>
						</div>
					{/key}
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Pause indicator -->
	{#if paused}
		<div class="slides-badge">PAUSED</div>
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

	/* ─── Top-right controls ─── */
	.slides-controls {
		position: fixed;
		top: 12px;
		right: 12px;
		z-index: 200;
		display: flex;
		gap: 6px;
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	.slides-root:hover .slides-controls,
	.slides-controls:focus-within {
		opacity: 1;
	}

	@media (pointer: coarse) {
		.slides-controls { opacity: 0.6; }
	}

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
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}

	.slides-ctrl-btn:hover {
		background: rgba(0, 0, 0, 0.65);
		color: white;
		border-color: rgba(255, 255, 255, 0.25);
	}

	/* ─── Hotkeys overlay ─── */
	.slides-hotkeys-overlay {
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

	.slides-hotkeys {
		background: var(--bg-secondary, #1a1020);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		padding: 28px 32px;
		max-width: 380px;
		width: 90%;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
		animation: scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.slides-hotkeys h3 {
		margin: 0 0 16px;
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.slides-hotkeys dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 16px;
		align-items: baseline;
	}

	.slides-hotkeys dt { text-align: right; white-space: nowrap; }

	.slides-hotkeys dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.slides-hotkeys kbd {
		display: inline-block;
		padding: 2px 7px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.slides-hotkeys__swipe {
		margin: 14px 0 0;
		font-size: 0.78rem;
		color: var(--text-tertiary);
		font-style: italic;
	}

	.slides-hotkeys__close {
		display: block;
		margin: 16px auto 0;
		padding: 6px 20px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
		font-family: var(--font-display);
		font-size: 0.82rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.slides-hotkeys__close:hover {
		background: rgba(255, 255, 255, 0.12);
		color: var(--text-primary);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes scaleIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}

	/* ─── Title card ─── */
	.slides-title-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		padding: 0 48px;
		animation: slidesTitleIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.slides-title {
		font-size: 2.8rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}

	.slides-subtitle {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin-top: 16px;
		max-width: 600px;
		line-height: 1.5;
	}

	@keyframes slidesTitleIn {
		from { opacity: 0; transform: translateY(24px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ════════════════════════════════════════════
	   Chat bubbles (shared by both layouts)
	   ════════════════════════════════════════════ */

	.bubble {
		max-width: 620px;
		padding: 20px 24px;
		border-radius: 16px;
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--text-primary);
	}

	.bubble__sender {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-bottom: 6px;
		opacity: 0.7;
	}

	.bubble__text {
		font-family: var(--font-mono);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.bubble__html :global(p) { margin: 0 0 10px; }
	.bubble__html :global(p:last-child) { margin-bottom: 0; }
	.bubble__html :global(strong) { color: var(--text-primary); }

	/* User bubble — right-aligned, orange */
	.bubble--user {
		margin-left: auto;
		background: rgba(233, 84, 32, 0.12);
		border: 1px solid rgba(233, 84, 32, 0.2);
		border-radius: 16px 16px 4px 16px;
		text-align: right;
	}

	.bubble--user .bubble__sender {
		color: var(--orange-400, #E95420);
	}

	/* AI bubble — left-aligned, teal */
	.bubble--ai {
		margin-right: auto;
		background: rgba(42, 161, 152, 0.1);
		border: 1px solid rgba(42, 161, 152, 0.18);
		border-radius: 16px 16px 16px 4px;
	}

	.bubble--ai .bubble__sender {
		color: var(--teal, #2AA198);
	}

	/* Compact bubble (action layout top bar) */
	.bubble--compact {
		max-width: none;
		padding: 12px 18px;
		font-size: 0.95rem;
	}

	.bubble--compact .bubble__sender {
		display: inline;
		margin-right: 8px;
		margin-bottom: 0;
	}

	.bubble--compact .bubble__text {
		display: inline;
	}

	/* ════════════════════════════════════════════
	   CHAT LAYOUT — prompt right, answer left
	   ════════════════════════════════════════════ */

	.chat-layout {
		position: relative;
		z-index: 1;
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px;
	}

	.chat-thread {
		display: flex;
		flex-direction: column;
		gap: 24px;
		width: 100%;
		max-width: 720px;
	}

	.chat-comment {
		position: absolute;
		bottom: 32px;
		left: 50%;
		transform: translateX(-50%);
		animation: commentIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.chat-comment__bubble {
		padding: 12px 20px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--text-tertiary);
		max-width: 600px;
		text-align: center;
	}

	/* ════════════════════════════════════════════
	   ACTION LAYOUT — windows center stage
	   ════════════════════════════════════════════ */

	.action-layout {
		position: relative;
		z-index: 1;
		height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.action-top {
		flex-shrink: 0;
		padding: 20px 32px 0 32px;
	}

	.action-center {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	.action-bottom {
		flex-shrink: 0;
		padding: 0 32px 24px;
		display: flex;
		justify-content: flex-start;
	}

	.action-bottom .bubble--ai {
		max-width: 560px;
	}

	.action-comment {
		padding: 10px 18px;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--text-tertiary);
		animation: commentIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	/* ─── Window stack (shared) ─── */

	.slides-stack-window {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 85%;
		max-width: 750px;
		transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
		            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
		            filter 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.slides-window {
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg-primary);
		box-shadow:
			0 8px 40px rgba(0, 0, 0, 0.35),
			0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.slides-window__content {
		max-height: 55vh;
		overflow: hidden;
	}

	@keyframes commentIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ─── Pause indicator ─── */
	.slides-badge {
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

	/* ─── Mobile ─── */
	@media (max-width: 900px) {
		.slides-title-card { padding: 0 24px; }
		.slides-title { font-size: 1.8rem; }
		.slides-subtitle { font-size: 1rem; }

		.bubble {
			max-width: none;
			padding: 14px 18px;
			font-size: 0.95rem;
		}

		.chat-layout {
			padding: 24px 16px;
			justify-content: flex-start;
			padding-top: 48px;
		}

		.chat-thread { gap: 16px; }

		.chat-comment {
			position: relative;
			bottom: auto;
			left: auto;
			transform: none;
			margin-top: 24px;
		}

		.action-layout {
			height: auto;
			min-height: 100vh;
			overflow-y: auto;
		}

		.action-top { padding: 16px 16px 0; }
		.action-bottom { padding: 0 16px 16px; }

		.action-center {
			min-height: 220px;
			aspect-ratio: 4 / 3;
		}

		.slides-stack-window { width: 95%; }
		.slides-window__content { max-height: none; }

		.slides-badge { bottom: 12px; right: 12px; }
		.slides-controls { opacity: 0.6; }
	}
</style>
