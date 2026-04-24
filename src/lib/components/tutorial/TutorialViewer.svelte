<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import { langStore } from '$lib/stores/lang.svelte';
	import { getTutorialTitle, type Tutorial, type WindowStep } from '$lib/data/tutorials';
	import Taskbar from '$lib/components/tutorial/Taskbar.svelte';
	import ControlsPanel from '$lib/components/tutorial/ControlsPanel.svelte';
	import TerminalTranscript from '$lib/components/tutorial/TerminalTranscript.svelte';
	import DesktopStack from '$lib/components/tutorial/DesktopStack.svelte';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';

	let { tutorial }: { tutorial: Tutorial } = $props();
	let title = $derived(getTutorialTitle(tutorial.meta, langStore.current));

	/* ─── Log mode: simplified vs full ───────── */
	let logMode = $state<'simplified' | 'full'>('simplified');
	let hasFullLog = $derived(!!tutorial.fullRounds);
	let activeRounds = $derived(logMode === 'full' && tutorial.fullRounds ? tutorial.fullRounds : tutorial.rounds);

	/* ─── Flatten rounds into a single timeline ── */
	let allSteps = $derived(activeRounds.flatMap((r) => r.steps));
	let roundBoundaries = $derived(
		activeRounds.reduce<number[]>((acc, r, i) => {
			acc.push(i === 0 ? 0 : acc[i - 1] + activeRounds[i - 1].steps.length);
			return acc;
		}, [])
	);

	/* ─── Step timeline logic ─────────────────── */
	const totalSteps = $derived(allSteps.length - 1);
	let currentStep = $state(-1);
	let playing = $state(false);
	let playTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let detailMode = $state<'steps' | 'tutorial' | 'round'>('tutorial');
	let showSettings = $state(false);

	let terminalBody = $state<HTMLElement>(null!);
	let rightColumn = $state<HTMLElement>(null!);

	/* ─── Spacer heights (push content to bottom initially) ── */
	let spacerHeight = $state(0);

	/* ─── Maximize / focus ───────────────────── */
	let focusedWindow = $state<WindowStep | null>(null);
	function focusWindow(step: WindowStep) { focusedWindow = step; }
	function restoreFocus() { focusedWindow = null; }

	let windowSteps = $derived(
		allSteps
			.map((s, i) => ({ step: s, index: i }))
			.filter((x): x is { step: WindowStep; index: number } => x.step.type === 'window')
	);

	function resolveComment(c: unknown): string | undefined {
		if (!c) return undefined;
		if (typeof c === 'string') return c;
		if (typeof c === 'object' && 'en' in (c as object)) {
			const obj = c as { en: string; ja?: string };
			return langStore.current === 'ja' && obj.ja ? obj.ja : obj.en;
		}
		return undefined;
	}

	let tutorialStops = $derived(
		allSteps
			.map((s, i) => i)
			.filter((i) => !!allSteps[i].comment)
	);

	function getRoundIdx(step: number): number {
		let idx = 0;
		for (let i = 1; i < roundBoundaries.length; i++) {
			if (roundBoundaries[i] <= step) idx = i;
			else break;
		}
		return idx;
	}

	function getTutorialStopsForRound(roundIdx: number): number[] {
		const start = roundBoundaries[roundIdx];
		const end = roundIdx + 1 < roundBoundaries.length ? roundBoundaries[roundIdx + 1] : allSteps.length;
		return tutorialStops.filter((s) => s >= start && s < end);
	}

	function getTutorialIdxInRound(step: number): number {
		const ri = getRoundIdx(step);
		const stops = getTutorialStopsForRound(ri);
		let idx = -1;
		for (let i = 0; i < stops.length; i++) {
			if (stops[i] <= step) idx = i;
			else break;
		}
		return idx;
	}

	let currentRoundIdx = $derived(currentStep >= 0 ? getRoundIdx(currentStep) : -1);
	let currentTutorialInRound = $derived(currentStep >= 0 ? getTutorialIdxInRound(currentStep) : -1);

	const defaultComment =
		'Press <strong>Next</strong> or <strong>Play</strong> to step through the AI trace, or simply scroll through the terminal.';

	function getCommentForStep(step: number): string {
		for (let s = step; s >= 0; s--) {
			const resolved = resolveComment(allSteps[s]?.comment);
			if (resolved) return resolved;
		}
		return defaultComment;
	}

	let currentComment = $derived(getCommentForStep(currentStep));

	async function showUpTo(step: number) {
		currentStep = step;
		if (!browser || !terminalBody) return;
		scrollDriven = false;
		await tick();
		const isMobile = window.innerWidth <= 900;
		const scroller: HTMLElement | Window = isMobile ? window : terminalBody;
		if (isMobile) {
			if (step < 0) {
				window.scrollTo({ top: 0, behavior: 'smooth' });
			} else {
				const el = terminalBody.querySelector<HTMLElement>(`[data-step="${Math.min(step, totalSteps)}"]`);
				if (el) {
					const panelH = rightColumn?.getBoundingClientRect().height ?? 100;
					const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight + panelH + 60;
					window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
				}
			}
		} else {
			if (step < 0) {
				terminalBody.scrollTo({ top: 0, behavior: 'smooth' });
			} else {
				const el = terminalBody.querySelector<HTMLElement>(`[data-step="${Math.min(step, totalSteps)}"]`);
				if (el) {
					const targetScroll = el.offsetTop + el.offsetHeight - terminalBody.clientHeight;
					terminalBody.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
				}
			}
		}
		let reenabled = false;
		const reenable = () => {
			if (reenabled) return;
			reenabled = true;
			scrollDriven = true;
			scroller.removeEventListener('scrollend', reenable);
		};
		if ('onscrollend' in scroller) {
			scroller.addEventListener('scrollend', reenable, { once: true });
		}
		setTimeout(reenable, 1200);
	}

	function setLogMode(mode: 'simplified' | 'full') {
		if (mode === logMode) return;
		stopPlay();
		logMode = mode;
		currentStep = -1;
		if (browser && terminalBody) {
			terminalBody.scrollTop = 0;
		}
	}

	function setDetailMode(mode: 'steps' | 'tutorial' | 'round') {
		if (mode === detailMode) return;
		detailMode = mode;
		if (mode === 'round') {
			if (currentStep < 0) return;
			const ri = getRoundIdx(currentStep);
			const roundEnd = ri + 1 < roundBoundaries.length ? roundBoundaries[ri + 1] - 1 : totalSteps;
			showUpTo(roundEnd);
		} else if (mode === 'tutorial') {
			if (currentStep < 0) return;
			const ri = getRoundIdx(currentStep);
			const stops = getTutorialStopsForRound(ri);
			const lastStop = stops.filter((s) => s <= currentStep).pop();
			if (lastStop !== undefined) showUpTo(lastStop);
		}
	}

	function next() {
		if (currentStep >= totalSteps) {
			stopPlay();
			return;
		}
		if (detailMode === 'round') {
			const ri = getRoundIdx(currentStep);
			if (ri + 1 < roundBoundaries.length) {
				showUpTo(roundBoundaries[ri + 1]);
			} else {
				showUpTo(totalSteps);
			}
		} else if (detailMode === 'tutorial') {
			const nextStop = tutorialStops.find((s) => s > currentStep);
			if (nextStop !== undefined) {
				showUpTo(nextStop);
			} else {
				showUpTo(totalSteps);
			}
		} else {
			showUpTo(currentStep + 1);
		}
		if (currentStep >= totalSteps) stopPlay();
	}

	function prev() {
		stopPlay();
		if (currentStep <= -1) return;
		if (detailMode === 'round') {
			const ri = getRoundIdx(currentStep);
			if (currentStep > roundBoundaries[ri]) {
				showUpTo(roundBoundaries[ri]);
			} else if (ri > 0) {
				showUpTo(roundBoundaries[ri - 1]);
			} else {
				showUpTo(-1);
			}
		} else if (detailMode === 'tutorial') {
			const prevStops = tutorialStops.filter((s) => s < currentStep);
			if (prevStops.length > 0) {
				showUpTo(prevStops[prevStops.length - 1]);
			} else {
				showUpTo(-1);
			}
		} else {
			showUpTo(Math.max(-1, currentStep - 1));
		}
	}

	function jumpToStep(step: number) {
		stopPlay();
		showUpTo(step);
	}

	function startPlay() {
		playing = true;
		next();
		playTimer = setInterval(() => {
			if (currentStep >= totalSteps) {
				stopPlay();
				return;
			}
			next();
		}, 1800);
	}

	function stopPlay() {
		playing = false;
		if (playTimer) {
			clearInterval(playTimer);
			playTimer = null;
		}
	}

	function togglePlay() {
		if (playing) {
			stopPlay();
		} else {
			if (currentStep >= totalSteps) showUpTo(-1);
			startPlay();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && focusedWindow !== null) {
			e.preventDefault();
			restoreFocus();
			return;
		}
		if (e.key === 'ArrowRight' || e.key === ' ') {
			e.preventDefault();
			next();
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		}
		if (e.key === 'p') {
			e.preventDefault();
			togglePlay();
		}
	}

	let displayRoundIdx = $derived(currentStep >= 0 ? getRoundIdx(currentStep) : 0);

	onMount(() => {
		document.body.classList.add('tutorial-active');
		return () => document.body.classList.remove('tutorial-active');
	});

	/* ─── Scroll-driven timeline ─────────────── */
	let scrollDriven = $state(true);

	onMount(() => {
		const updateSpacerHeight = () => {
			if (!terminalBody) return;
			const firstPrompt = terminalBody.querySelector<HTMLElement>('.round-prompt-block');
			const promptH = firstPrompt?.offsetHeight ?? 0;
			spacerHeight = Math.max(0, terminalBody.clientHeight - promptH - 32);
		};
		updateSpacerHeight();

		const resizeObs = new ResizeObserver(updateSpacerHeight);
		resizeObs.observe(terminalBody);

		const isMobileQuery = window.matchMedia('(max-width: 900px)');

		const handleScroll = () => {
			if (!terminalBody || playing || !scrollDriven) return;

			if (isMobileQuery.matches) {
				const positionLine = (rightColumn?.getBoundingClientRect().top ?? window.innerHeight) - 20;
				let maxVisible = -1;
				for (const el of terminalBody.querySelectorAll<HTMLElement>('[data-step]')) {
					const idx = Number(el.dataset.step ?? '');
					if (isNaN(idx)) continue;
					if (el.getBoundingClientRect().top < positionLine) maxVisible = idx;
				}
				if (maxVisible !== currentStep) currentStep = maxVisible;
			} else {
				const viewportBottom = terminalBody.scrollTop + terminalBody.clientHeight;
				let maxVisible = -1;
				for (const el of terminalBody.querySelectorAll<HTMLElement>('[data-step]')) {
					const idx = Number(el.dataset.step ?? '');
					if (isNaN(idx)) continue;
					const elBottom = el.offsetTop + el.offsetHeight;
					if (elBottom <= viewportBottom + 1) maxVisible = idx;
				}
				if (maxVisible !== currentStep) currentStep = maxVisible;
			}
		};

		terminalBody?.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			resizeObs.disconnect();
			terminalBody?.removeEventListener('scroll', handleScroll);
			window.removeEventListener('scroll', handleScroll);
		};
	});

	function getStackClass(winIndex: number): string {
		const visibleWindows = windowSteps.filter((x) => x.index <= currentStep);
		const visIdx = visibleWindows.findIndex((x) => x.index === windowSteps[winIndex].index);
		if (visIdx < 0) return '';
		const depth = visibleWindows.length - 1 - visIdx;
		if (depth > 3) return 'stack-3';
		return `stack-${depth}`;
	}
</script>

<svelte:head>
	<title>{title} — AI Research Tutorials</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} onpointerdown={() => showSettings = false} />

<div class="desktop">
	<!-- Top Panel -->
	<Nav showBack pageTitle={title} editHref="{base}/compose/{tutorial.meta.slug}" />

	<!-- Workspace -->
	<div class="workspace">
		<!-- Terminal Window -->
		<TerminalTranscript
			{activeRounds}
			{roundBoundaries}
			{allSteps}
			{spacerHeight}
			{displayRoundIdx}
			isFullLog={logMode === 'full'}
			onFocusWindow={focusWindow}
			bind:terminalBodyRef={terminalBody}
		/>

		<!-- Right Column: Fiji windows (incl. max overlay) + controls -->
		<div class="right-column" bind:this={rightColumn}>
			<DesktopStack
				{windowSteps}
				{currentStep}
				{focusedWindow}
				meta={tutorial.meta}
				welcome={tutorial.welcome}
				briefing={tutorial.briefing}
				{hasFullLog}
				{logMode}
				{getStackClass}
				onFocus={focusWindow}
				onRestore={restoreFocus}
				onJump={jumpToStep}
				onSetLogMode={setLogMode}
			/>

			<!-- Bottom Panel: Comment + Controls -->
			<ControlsPanel
				commentHtml={currentComment}
				{currentStep}
				{currentRoundIdx}
				{currentTutorialInRound}
				{playing}
				{hasFullLog}
				bind:logMode
				bind:detailMode
				bind:showSettings
				onPrev={prev}
				onNext={next}
				onTogglePlay={togglePlay}
				onSetDetailMode={setDetailMode}
				onSetLogMode={setLogMode}
			/>
		</div>
	</div>

	<!-- Bottom Taskbar -->
	<Taskbar {windowSteps} {currentStep} {getStackClass} onJump={jumpToStep} />
</div>

<style>
	:global(body.tutorial-active) {
		overflow: hidden;
	}

	.desktop {
		position: relative;
		width: 100vw;
		height: 100vh;
		background: #2C001E;
		display: flex;
		flex-direction: column;
	}

	.desktop::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(233, 84, 32, 0.52) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(245, 140, 55, 0.32) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(200, 60, 115, 0.24) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(210, 110, 170, 0.32) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(250, 160, 60, 0.26) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(150, 60, 140, 0.22) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(255, 130, 60, 0.50) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(255, 185, 110, 0.42) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(78, 22, 54, 0.45) 0%, transparent 70%),
			linear-gradient(150deg, #3a0626 0%, #461230 20%, #521a3a 40%, #481530 60%, #380a28 80%, #320822 100%);
		filter: blur(40px) saturate(1.5);
	}

	.desktop::after {
		content: '';
		position: fixed;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
		pointer-events: none;
		z-index: 999;
		opacity: 0.4;
	}

	.desktop :global(.nav) {
		position: relative;
		flex-shrink: 0;
		background: rgba(28, 16, 23, 0.85);
	}

	.desktop :global(.nav__inner) {
		max-width: none;
	}

	.workspace {
		flex: 1;
		display: flex;
		gap: 0;
		padding: 18px 22px;
		overflow: hidden;
		position: relative;
		z-index: 1;
	}

	.right-column {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding-left: 22px;
		min-width: 0;
		gap: 10px;
	}

	@media (max-width: 900px) {
		:global(body.tutorial-active) { overflow: visible !important; overflow-y: auto !important; }

		.desktop {
			height: auto;
			min-height: 100vh;
			min-height: 100dvh;
		}

		.workspace {
			flex-direction: column;
			padding: 0;
			gap: 0;
			overflow: visible;
			flex: 0 0 auto;
		}

		.right-column {
			order: 1;
			padding: 0;
			gap: 0;
			flex: none;
			position: sticky;
			bottom: 0;
			z-index: 20;
		}
	}
</style>
