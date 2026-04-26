<script lang="ts">
	import type { Tutorial, Step, WindowStep, AssistantStep, TutorialRound } from '$lib/data/tutorials';
	import { getTutorialTitle, getWindowIcon, isChromeless } from '$lib/data/tutorials';
	import { langStore } from '$lib/stores/lang.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import Wallpaper from '$lib/components/Wallpaper.svelte';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import PromoProgress from './PromoProgress.svelte';
	import PromoPrompt from './PromoPrompt.svelte';
	import PromoStep from './PromoStep.svelte';

	let { tutorial }: { tutorial: Tutorial } = $props();

	const PROMPT_DURATION = 3500;
	const WINDOW_DURATION = 5000;
	const ANSWER_DURATION = 6000;
	const TITLE_DURATION = 3000;
	const SCENE_GAP = 800;

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
						duration: step.promoDuration ?? WINDOW_DURATION
					});
				} else if (step.type === 'assistant' && (step as AssistantStep).final) {
					items.push({
						kind: 'answer',
						round,
						step,
						duration: step.promoDuration ?? ANSWER_DURATION
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

	function advance() {
		if (paused) return;
		const items = scenes[currentScene];
		if (!items) { phase = 'done'; if (recording) setTimeout(stopRecording, 1500); return; }

		currentItemInScene++;
		itemsShown++;

		if (currentItemInScene >= items.length) {
			// Scene done — move to next
			currentScene++;
			currentItemInScene = -1;
			if (currentScene >= scenes.length) {
				phase = 'done';
				if (recording) setTimeout(stopRecording, 1500);
				return;
			}
			timerId = setTimeout(advance, SCENE_GAP);
			return;
		}

		const item = items[currentItemInScene];
		timerId = setTimeout(advance, item.duration);
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
			if (timerId) { clearTimeout(timerId); timerId = null; }
		} else {
			advance();
		}
	}

	/* ─── Recording ──────────────────────────── */

	let recording = $state(false);
	let mediaRecorder: MediaRecorder | null = null;
	let recordedChunks: Blob[] = [];
	let displayStream: MediaStream | null = null;

	async function startRecording() {
		try {
			displayStream = await navigator.mediaDevices.getDisplayMedia({
				video: { displaySurface: 'browser' } as any,
				audio: false
			});
		} catch { return; }

		recordedChunks = [];
		const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
			? 'video/webm;codecs=vp9' : 'video/webm';
		mediaRecorder = new MediaRecorder(displayStream, { mimeType });
		mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
		mediaRecorder.onstop = () => {
			const blob = new Blob(recordedChunks, { type: mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${tutorial.meta.slug}-promo.webm`;
			a.click();
			URL.revokeObjectURL(url);
			displayStream?.getTracks().forEach(t => t.stop());
			displayStream = null;
			recording = false;
		};
		displayStream.getVideoTracks()[0].onended = () => stopRecording();
		mediaRecorder.start();
		recording = true;
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.code === 'Space') { e.preventDefault(); togglePause(); }
		if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
			recording ? stopRecording() : startRecording();
		}
	}

	onMount(() => { timerId = setTimeout(startPlayback, TITLE_DURATION); });
	onDestroy(() => {
		if (timerId) clearTimeout(timerId);
		stopRecording();
		displayStream?.getTracks().forEach(t => t.stop());
	});

	let title = $derived(getTutorialTitle(tutorial.meta, langStore.current));
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="promo-root">
	<Wallpaper />
	<PromoProgress {progress} />

	<!-- Title card -->
	{#if phase === 'title'}
		<div class="promo-title-card">
			<h1 class="promo-title">{title}</h1>
			{#if tutorial.description}
				<p class="promo-subtitle">{tutorial.description}</p>
			{/if}
		</div>
	{/if}

	<!-- Split layout -->
	{#if phase === 'playing' || phase === 'done'}
		<div class="promo-layout">
			<!-- Left: prompt + answer -->
			<div class="promo-left">
				{#if activePrompt}
					{#key `${currentScene}-prompt`}
						<div class="promo-left__prompt">
							<PromoStep kind="prompt">
								<PromoPrompt
									text={activePrompt.round.prompt}
									kind={activePrompt.round.kind ?? 'claude'}
								/>
							</PromoStep>
						</div>
					{/key}
				{/if}

				{#if activeAnswer}
					{#key `${currentScene}-answer`}
						<div class="promo-left__answer">
							<PromoStep kind="final">
								<div class="promo-answer">
									{@html activeAnswer.html}
								</div>
							</PromoStep>
						</div>
					{/key}
				{/if}
			</div>

			<!-- Right: window stack -->
			<div class="promo-right">
				{#if activeWindows.length > 0}
					<div class="promo-desktop">
						{#each activeWindows as win, wi (wi + '-' + currentScene)}
							<div
								class="promo-stack-window"
								style={windowStackStyle(wi, activeWindows.length)}
							>
								<div class="promo-window">
									{#if !isChromeless(win.content)}
										<WindowChrome
											title={win.windowTitle}
											subtitle={win.subtitle}
											icon={win.icon ?? getWindowIcon(win.content)}
										/>
									{/if}
									<div class="promo-window__content">
										<WindowContent content={win.content} />
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Controls -->
	<div class="promo-controls">
		{#if paused}<span class="promo-badge">PAUSED</span>{/if}
		<button
			class="promo-rec-btn"
			class:active={recording}
			onclick={() => recording ? stopRecording() : startRecording()}
		>
			<span class="rec-dot"></span>
			{recording ? 'Stop' : 'Rec'}
		</button>
	</div>
</div>

<style>
	.promo-root {
		position: fixed;
		inset: 0;
		overflow: hidden;
		font-family: var(--font-display);
	}

	/* ─── Title card ─── */
	.promo-title-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		padding: 0 48px;
		animation: promoTitleIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.promo-title {
		font-size: 2.8rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}

	.promo-subtitle {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin-top: 16px;
		max-width: 600px;
		line-height: 1.5;
	}

	@keyframes promoTitleIn {
		from { opacity: 0; transform: translateY(24px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ─── Split layout ─── */
	.promo-layout {
		position: relative;
		z-index: 1;
		display: flex;
		height: 100vh;
	}

	/* ─── Left column: prompt + answer ─── */
	.promo-left {
		width: 38%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 48px 32px 48px 48px;
		overflow: hidden;
	}

	.promo-left__prompt {
		flex-shrink: 0;
	}

	.promo-left__answer {
		flex-shrink: 0;
		margin-top: auto;
	}

	.promo-answer {
		padding: 24px 28px;
		border-left: 4px solid var(--teal, #2AA198);
		border-radius: 10px;
		background: rgba(42, 161, 152, 0.08);
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--text-primary);
	}

	.promo-answer :global(p) {
		margin: 0 0 12px;
	}
	.promo-answer :global(p:last-child) {
		margin-bottom: 0;
	}
	.promo-answer :global(strong) {
		color: var(--text-primary);
	}

	/* ─── Right column: window desktop ─── */
	.promo-right {
		width: 62%;
		height: 100vh;
		position: relative;
	}

	.promo-desktop {
		position: absolute;
		inset: 24px;
	}

	.promo-stack-window {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 90%;
		max-width: 750px;
		transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
		            transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
		            filter 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.promo-window {
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg-primary);
		box-shadow:
			0 8px 40px rgba(0, 0, 0, 0.35),
			0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.promo-window__content {
		max-height: 65vh;
		overflow: hidden;
	}

	/* ─── Controls overlay ─── */
	.promo-controls {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.promo-badge {
		padding: 6px 14px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.6);
		color: var(--text-secondary);
		font-size: 0.7rem;
		font-family: var(--font-mono);
		letter-spacing: 0.15em;
		backdrop-filter: blur(8px);
	}

	.promo-rec-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border: none;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.6);
		color: var(--text-secondary);
		font-size: 0.7rem;
		font-family: var(--font-mono);
		letter-spacing: 0.08em;
		cursor: pointer;
		backdrop-filter: blur(8px);
		transition: background 0.15s;
	}

	.promo-rec-btn:hover { background: rgba(0, 0, 0, 0.75); }
	.promo-rec-btn.active { background: rgba(180, 30, 30, 0.7); color: #fff; }

	.rec-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #e53e3e;
		flex-shrink: 0;
	}

	.promo-rec-btn.active .rec-dot {
		animation: recBlink 1s ease-in-out infinite;
	}

	@keyframes recBlink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
</style>
