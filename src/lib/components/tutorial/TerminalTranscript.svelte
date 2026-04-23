<!--
	Left-column terminal window: chrome + scrollable transcript.

	Layout model (desktop):
	- Top spacer (spacerHeight) pushes the first prompt to the viewport bottom
	  initially so readers see one prompt at eye-level.
	- Each round is its own `.round-block` — prompt N is `position: sticky`
	  within it, so N releases as the round scrolls past (prevents prompts
	  stacking behind each other when the next round enters).
	- Bottom spacer lets the last step scroll to the viewport bottom.

	Mobile (<=900px): the whole thing collapses to regular document flow —
	spacers hidden, sticky prompts static, chrome hidden — and the parent
	page's body is what scrolls.

	Ref: `terminalBodyRef` is exposed via $bindable so the parent can wire
	scroll-driven timeline logic. We can't just return the ref because the
	parent needs to observe it (ResizeObserver, scroll listener).
-->
<script lang="ts">
	import type { TutorialRound, Step, WindowStep } from '$lib/data/tutorials';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import StepRenderer from './StepRenderer.svelte';
	import CompactChipFlow from './CompactChipFlow.svelte';

	let {
		activeRounds,
		roundBoundaries,
		allSteps,
		spacerHeight,
		displayRoundIdx,
		isFullLog = false,
		onFocusWindow,
		terminalBodyRef = $bindable<HTMLElement | null>(null)
	}: {
		activeRounds: TutorialRound[];
		roundBoundaries: number[];
		allSteps: Step[];
		spacerHeight: number;
		displayRoundIdx: number;
		isFullLog?: boolean;
		onFocusWindow: (step: WindowStep) => void;
		terminalBodyRef?: HTMLElement | null;
	} = $props();

	type StepGroup =
		| { kind: 'step'; step: Step; si: number; globalIndex: number }
		| { kind: 'compact'; steps: Step[]; startSi: number; globalIndex: number }
		| { kind: 'hidden'; steps: Step[]; startSi: number; count: number; globalIndex: number };

	function groupSteps(steps: Step[], roundStart: number): StepGroup[] {
		if (isFullLog) {
			return steps.map((step, si) => ({ kind: 'step' as const, step, si, globalIndex: roundStart + si }));
		}
		const groups: StepGroup[] = [];
		let hiddenRun: Step[] = [];
		let hiddenStartSi = 0;
		let compactRun: Step[] = [];
		let compactStartSi = 0;

		function flushCompact() {
			if (compactRun.length > 0) {
				groups.push({ kind: 'compact', steps: compactRun, startSi: compactStartSi, globalIndex: roundStart + compactStartSi });
				compactRun = [];
			}
		}

		function flushHidden() {
			if (hiddenRun.length > 0) {
				groups.push({ kind: 'hidden', steps: hiddenRun, startSi: hiddenStartSi, count: hiddenRun.length, globalIndex: roundStart + hiddenStartSi });
				hiddenRun = [];
			}
		}

		for (let si = 0; si < steps.length; si++) {
			const step = steps[si];
			if (step.hidden) {
				flushCompact();
				if (hiddenRun.length === 0) hiddenStartSi = si;
				hiddenRun.push(step);
			} else if (step.compact) {
				flushHidden();
				if (compactRun.length === 0) compactStartSi = si;
				compactRun.push(step);
			} else {
				flushHidden();
				flushCompact();
				groups.push({ kind: 'step', step, si, globalIndex: roundStart + si });
			}
		}
		flushHidden();
		flushCompact();
		return groups;
	}

	let expandedHiddenGroups = $state(new Set<string>());

	function toggleHiddenGroup(key: string) {
		const next = new Set(expandedHiddenGroups);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedHiddenGroups = next;
	}
</script>

<div class="terminal-container">
	<div class="window terminal-window active">
		<WindowChrome
			title="claude — Round {displayRoundIdx + 1}"
			icon="&#8250;_"
			variant="primary"
		/>

		<div class="terminal-body-wrap">
			<div class="terminal-body" bind:this={terminalBodyRef}>
				<!-- Top spacer: pushes first content to bottom of viewport initially -->
				<div class="terminal-spacer" style="height: {spacerHeight}px">
					<div class="nav-hints">
						<div class="hint-row">
							<span class="hint-keys">
								<kbd>&#8592;</kbd><kbd>&#8594;</kbd>
							</span>
							<span class="hint-text">Navigate steps</span>
						</div>
						<div class="hint-row">
							<span class="hint-keys">
								<kbd class="hint-key-wide">Scroll</kbd>
							</span>
							<span class="hint-text">Browse the session</span>
						</div>
						<div class="hint-row">
							<span class="hint-keys">
								<kbd>P</kbd>
							</span>
							<span class="hint-text">Auto-play</span>
						</div>
					</div>
				</div>
				{#each activeRounds as round, ri}
					{@const isTerminal = round.kind === 'terminal'}
					{@const roundStart = roundBoundaries[ri]}
					<div class="round-block">
						<div
							data-step="{roundStart}-prompt"
							class="step-block round-prompt-block"
						>
							{#if isTerminal}
								<div class="prompt-block terminal-prompt">
									{#if round.cwd}<div class="terminal-cwd">{round.cwd}</div>{/if}
									<div class="terminal-cmd"><span class="terminal-percent">%</span> {round.prompt}</div>
								</div>
							{:else}
								<div class="prompt-block">
									<span class="prompt-chevron">&#8250;</span>
									<div class="prompt-text">{round.prompt}</div>
								</div>
							{/if}
						</div>
						{#each groupSteps(round.steps, roundStart) as group}
							{#if group.kind === 'step'}
								<div
									data-step={group.globalIndex}
									class="step-block"
								>
									<StepRenderer
										step={group.step}
										showClaudeLabel={group.step.type === 'assistant' && group.si === 0}
										isLast={group.globalIndex === allSteps.length - 1}
										{onFocusWindow}
									/>
								</div>
							{:else if group.kind === 'compact'}
								<div
									data-step={group.globalIndex}
									class="step-block"
								>
									<CompactChipFlow steps={group.steps} {onFocusWindow} />
								</div>
							{:else}
								{@const groupKey = `${ri}-${group.startSi}`}
								{@const expanded = expandedHiddenGroups.has(groupKey)}
								<div
									data-step={group.globalIndex}
									class="step-block"
								>
									<button
										type="button"
										class="hidden-group-bar"
										onclick={() => toggleHiddenGroup(groupKey)}
									>
										<span class="hidden-chevron" class:expanded>{expanded ? '▾' : '▸'}</span>
										<span class="hidden-label">{group.count} step{group.count > 1 ? 's' : ''} hidden</span>
									</button>
									{#if expanded}
										{#each group.steps as hStep, hsi}
											<div
												data-step={roundStart + group.startSi + hsi}
												class="step-block hidden-step-revealed"
											>
												<StepRenderer
													step={hStep}
													showClaudeLabel={false}
													isLast={false}
													{onFocusWindow}
												/>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/each}
				<!-- Bottom spacer: allows last step to scroll to viewport bottom -->
				<div class="terminal-spacer" style="height: {spacerHeight}px"></div>
			</div>
		</div>
	</div>
</div>

<style>
	/* ─── Terminal Window shell ── */
	.terminal-container {
		width: 52%;
		min-width: 500px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		z-index: 10;
	}

	.terminal-window {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.terminal-body-wrap {
		flex: 1;
		position: relative;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.terminal-body {
		flex: 1;
		background: #241a20;
		overflow-y: auto;
		padding: 16px 20px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.65;
		scroll-behavior: smooth;
	}

	.terminal-body::-webkit-scrollbar { width: 8px; }
	.terminal-body::-webkit-scrollbar-track { background: #241a20; }
	.terminal-body::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 4px; }

	/* Spacer pushes content to bottom initially (and lets last step reach bottom) */
	.terminal-spacer {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-hints {
		display: flex;
		flex-direction: column;
		gap: 12px;
		opacity: 0.45;
	}

	.hint-row {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.hint-keys {
		display: flex;
		gap: 5px;
		min-width: 80px;
		justify-content: flex-end;
	}

	.hint-keys kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 28px;
		padding: 0 8px;
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		line-height: 1;
	}

	.hint-key-wide {
		padding: 0 10px !important;
		font-size: 11px !important;
		letter-spacing: 0.3px;
	}

	.hint-text {
		font-family: var(--font-display);
		font-size: 14px;
		color: var(--text-tertiary);
	}

	/* ─── Step wrapper ── */
	.step-block {
		display: block;
	}

	/* ─── Prompt blocks ── */
	.prompt-block {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 14px 20px;
		margin-top: 20px;
		background: rgba(233, 84, 32, 0.11);
		border-right: 3px solid var(--accent);
		border-radius: 6px 0 0 6px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.65;
	}

	/* First prompt in transcript: no top margin */
	.round-block:first-child .prompt-block {
		margin-top: 0;
	}

	.prompt-chevron {
		color: var(--accent);
		font-weight: 700;
		font-size: 18px;
		line-height: 1.4;
		flex-shrink: 0;
		user-select: none;
	}

	.prompt-text {
		color: var(--text-primary);
		font-weight: 500;
	}

	/* ── Terminal-round prompt variant ── */
	.prompt-block.terminal-prompt {
		background: rgba(255, 255, 255, 0.04);
		border-right-color: var(--text-tertiary);
		flex-direction: column;
		gap: 2px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.5;
	}

	.terminal-cwd {
		color: var(--teal);
		font-size: 12px;
		font-weight: 600;
	}

	.terminal-cmd {
		color: var(--text-primary);
	}

	.terminal-percent {
		color: var(--green);
		font-weight: 700;
		user-select: none;
	}

	/* ─── Round-level sticky prompts ── */
	/* Each round is its own containing block so prompt N releases when round N
	   scrolls out, instead of stacking behind prompt N+1. */
	.round-block {
		display: block;
	}

	.round-prompt-block {
		position: sticky;
		top: 0;
		z-index: 10;
		background: #241a20;
		margin: 0 -20px;
		padding: 0 20px;
	}

	.round-prompt-block .prompt-block {
		margin: 0;
	}

	/* ── Hidden step group ── */
	.hidden-group-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px 14px;
		margin: 4px 0;
		background: none;
		border: none;
		border-left: 2px dashed var(--border-subtle);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color 0.15s, background 0.15s;
		text-align: left;
	}

	.hidden-group-bar:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.02);
	}

	.hidden-chevron {
		font-size: 10px;
		flex-shrink: 0;
		transition: transform 0.15s;
	}

	.hidden-label {
		opacity: 0.7;
	}

	.hidden-step-revealed {
		opacity: 0.6;
		border-left: 1px dashed var(--border-subtle);
		margin-left: 8px;
		padding-left: 6px;
	}

	/* Center the mobile inline window within its step-block */
	.step-block:has(:global(.inline-fiji)) {
		text-align: center;
	}

	/* ─── Mobile: inline document flow ── */
	@media (max-width: 900px) {
		.terminal-container {
			width: 100%;
			min-width: 0;
			flex: 0 0 auto;
		}

		.terminal-window {
			border-radius: 0;
			border: none;
			box-shadow: none;
			flex: 0 0 auto;
		}

		.terminal-window > :global(.window-header) { display: none; }

		/* On mobile, prompts are regular flow (not sticky) */
		.round-prompt-block {
			position: static;
			margin: 0;
			padding: 0;
		}
		.round-prompt-block .prompt-block { padding: 10px 14px; font-size: 12px; }

		.terminal-body-wrap {
			flex: 0 0 auto;
		}

		/* Content flows naturally — no internal scroll container */
		.terminal-body {
			padding: 14px;
			font-size: 12px;
			line-height: 1.6;
			overflow: visible;
			flex: 0 0 auto;
		}

		/* Hide spacers — content flows naturally */
		.terminal-spacer { display: none; }
	}

	@media (max-width: 480px) {
		.terminal-body { padding: 10px; font-size: 11px; line-height: 1.55; }
	}
</style>
