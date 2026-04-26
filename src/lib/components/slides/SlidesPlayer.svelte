<script lang="ts">
	import type { Tutorial, Step, WindowStep, AssistantStep, TutorialRound } from '$lib/data/tutorials';
	import { getTutorialTitle, getWindowIcon, isChromeless } from '$lib/data/tutorials';
	import { langStore } from '$lib/stores/lang.svelte';
	import { themeStore, THEMES } from '$lib/stores/theme.svelte';
	import { onMount, onDestroy } from 'svelte';
	import Wallpaper from '$lib/components/Wallpaper.svelte';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import SlidesProgress from './SlidesProgress.svelte';
	import SlidesPrompt from './SlidesPrompt.svelte';
	import SlidesStep from './SlidesStep.svelte';

	let { tutorial }: { tutorial: Tutorial } = $props();

	const PROMPT_DURATION = 1500;
	const WINDOW_DURATION = 2000;
	const ANSWER_DURATION = 5000;
	const TITLE_DURATION = 3000;
	const SCENE_GAP = 1200;

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

	function cycleTheme() {
		const idx = THEMES.findIndex(t => t.id === themeStore.theme);
		themeStore.theme = THEMES[(idx + 1) % THEMES.length].id;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.code === 'Space') { e.preventDefault(); togglePause(); }
		if (e.code === 'ArrowRight') { e.preventDefault(); stepForward(); }
		if (e.code === 'ArrowLeft') { e.preventDefault(); stepBack(); }
		if (e.code === 'KeyT' && !e.metaKey && !e.ctrlKey) cycleTheme();
		if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) resetPlayback();
	}

	onMount(() => { timerId = setTimeout(startPlayback, TITLE_DURATION); });
	onDestroy(() => { clearTimer(); });

	let title = $derived(getTutorialTitle(tutorial.meta, langStore.current));
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="slides-root">
	<Wallpaper />
	<SlidesProgress {progress} />

	<!-- Title card -->
	{#if phase === 'title'}
		<div class="slides-title-card">
			<h1 class="slides-title">{title}</h1>
			{#if tutorial.description}
				<p class="slides-subtitle">{tutorial.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Split layout -->
	{#if phase === 'playing' || phase === 'done'}
		<div class="slides-layout">
			<!-- Left: prompt + answer -->
			<div class="slides-left">
				{#if activePrompt}
					{#key `${currentScene}-prompt`}
						<div class="slides-left__section">
							<span class="slides-label">User Prompt</span>
							<SlidesStep kind="prompt">
								<SlidesPrompt
									text={activePrompt.round.prompt}
									kind={activePrompt.round.kind ?? 'claude'}
								/>
							</SlidesStep>
						</div>
					{/key}
				{/if}

				{#if activeAnswer}
					{#key `${currentScene}-answer`}
						<div class="slides-left__section">
							<span class="slides-label slides-label--teal">AI Agent Response</span>
							<SlidesStep kind="final">
								<div class="slides-answer">
									{@html activeAnswer.html}
								</div>
							</SlidesStep>
						</div>
					{/key}
				{/if}
			</div>

			<!-- Right: label + window stack + comment -->
			<div class="slides-right">
				<span class="slides-label slides-label--green">AI Agent — Autonomous Actions</span>

				<div class="slides-desktop">
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

				{#if activeComment}
					{#key activeComment}
						<div class="slides-comment">
							<div class="slides-comment__bubble">
								{@html activeComment}
							</div>
						</div>
					{/key}
				{/if}
			</div>
		</div>
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

	/* ─── Split layout ─── */
	.slides-layout {
		position: relative;
		z-index: 1;
		display: flex;
		height: 100vh;
	}

	/* ─── Left column: prompt + answer stacked ─── */
	.slides-left {
		width: 38%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 48px 32px 48px 48px;
		overflow: hidden;
	}

	.slides-left__section {
		flex-shrink: 0;
	}

	.slides-label {
		display: block;
		font-size: 0.7rem;
		font-family: var(--font-mono);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--orange-400, #E95420);
		margin-bottom: 8px;
		opacity: 0.8;
	}

	.slides-label--teal {
		color: var(--teal, #2AA198);
	}

	.slides-label--green {
		color: var(--green, #4DAF7C);
	}

	.slides-answer {
		padding: 24px 28px;
		border-left: 4px solid var(--teal, #2AA198);
		border-radius: 10px;
		background: rgba(42, 161, 152, 0.08);
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--text-primary);
	}

	.slides-answer :global(p) {
		margin: 0 0 12px;
	}
	.slides-answer :global(p:last-child) {
		margin-bottom: 0;
	}
	.slides-answer :global(strong) {
		color: var(--text-primary);
	}

	/* ─── Right column: window desktop + comment ─── */
	.slides-right {
		width: 62%;
		height: 100vh;
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 48px 32px 24px 0;
	}

	.slides-desktop {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	.slides-stack-window {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 90%;
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
		max-height: 60vh;
		overflow: hidden;
	}

	/* ─── Comment bubble ─── */
	.slides-comment {
		flex-shrink: 0;
		padding-top: 16px;
		animation: commentIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.slides-comment__bubble {
		padding: 14px 20px;
		border-radius: 12px 12px 12px 4px;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-secondary);
		max-width: 600px;
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
</style>
