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
	import { langStore } from '$lib/stores/lang.svelte';
	let {
		activeRounds,
		roundBoundaries,
		allSteps,
		spacerHeight,
		displayRoundIdx,
		onFocusWindow,
		terminalBodyRef = $bindable<HTMLElement | null>(null)
	}: {
		activeRounds: TutorialRound[];
		roundBoundaries: number[];
		allSteps: Step[];
		spacerHeight: number;
		displayRoundIdx: number;
		onFocusWindow: (step: WindowStep) => void;
		terminalBodyRef?: HTMLElement | null;
	} = $props();

	type StepEntry = { kind: 'step'; step: Step; si: number; globalIndex: number };
	type CommentEntry = { kind: 'comment'; text: string };
	type Segment = { kind: 'steps'; entries: StepEntry[] } | CommentEntry;

	function groupSteps(steps: Step[], roundStart: number): StepEntry[] {
		return steps.map((step, si) => ({ kind: 'step' as const, step, si, globalIndex: roundStart + si }));
	}

	function segmentSteps(steps: Step[], roundStart: number): Segment[] {
		const segments: Segment[] = [];
		let currentBatch: StepEntry[] = [];
		for (let si = 0; si < steps.length; si++) {
			const step = steps[si];
			const entry: StepEntry = { kind: 'step', step, si, globalIndex: roundStart + si };
			currentBatch.push(entry);
			const comment = resolveComment(step.comment);
			if (comment) {
				segments.push({ kind: 'steps', entries: currentBatch });
				segments.push({ kind: 'comment', text: comment });
				currentBatch = [];
			}
		}
		if (currentBatch.length > 0) {
			segments.push({ kind: 'steps', entries: currentBatch });
		}
		return segments;
	}

	function resolveComment(c: unknown): string | undefined {
		if (!c) return undefined;
		if (typeof c === 'string') return c;
		if (typeof c === 'object' && 'en' in (c as object)) {
			const obj = c as { en: string; ja?: string };
			return langStore.current === 'ja' && obj.ja ? obj.ja : obj.en;
		}
		return undefined;
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
					{@const segments = segmentSteps(round.steps, roundStart)}
					<div class="round-block">
						{#each segments as segment, segIdx}
							{#if segment.kind === 'steps'}
								{@const isLast = segIdx === segments.length - 1}
								<div class="terminal-segment" class:segment-continuation={segIdx > 0} class:segment-continues={!isLast}>
									{#if segIdx === 0}
										<div class="segment-titlebar">
											<span class="segment-dot segment-dot--red"></span>
											<span class="segment-dot segment-dot--yellow"></span>
											<span class="segment-dot segment-dot--green"></span>
											<span class="segment-title">claude — Round {ri + 1}</span>
										</div>
									{/if}
									{#if segIdx === 0}
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
									{/if}
									{#each segment.entries as group}
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
									{/each}
								</div>
							{:else}
								<div class="inline-comment">
									<div class="inline-comment__label">Tutorial</div>
									<div class="inline-comment__text">{@html segment.text}</div>
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
		background: var(--bg-terminal);
		overflow-y: auto;
		padding: 16px 20px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.65;
		scroll-behavior: smooth;
	}

	.terminal-body::-webkit-scrollbar { width: 8px; }
	.terminal-body::-webkit-scrollbar-track { background: var(--bg-terminal); }
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
		background: var(--glass-faint);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		box-shadow: var(--shadow-sm);
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
		background: var(--step-prompt-bg);
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
		background: var(--glass-faint);
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
		background: var(--bg-terminal);
		margin: 0 -20px;
		padding: 0 20px;
	}

	.round-prompt-block .prompt-block {
		margin: 0;
	}

	/* Center the mobile inline window within its step-block */
	.step-block:has(:global(.inline-fiji)) {
		text-align: center;
	}

	/* ─── Mobile-only elements (hidden on desktop) ── */
	.segment-titlebar {
		display: none;
	}

	.inline-comment {
		display: none;
	}

	/* ─── Mobile: inline document flow ── */
	@media (max-width: 900px) {
		.terminal-segment {
			background: var(--bg-terminal);
			border-radius: 12px;
			margin: 12px 0;
			overflow: hidden;
			border: 1px solid var(--border-subtle);
		}

		.terminal-segment.segment-continuation {
			border-radius: 0 0 12px 12px;
			margin-top: 40px;
			border-top: none;
			overflow: visible;
			position: relative;
		}

		.terminal-segment.segment-continues {
			border-radius: 12px 12px 0 0;
			margin-bottom: 40px;
			border-bottom: none;
			overflow: visible;
			position: relative;
		}

		.terminal-segment.segment-continuation.segment-continues {
			border-radius: 0;
		}

		.terminal-segment .step-block:first-child {
			padding-top: 14px;
		}

		.terminal-segment .step-block:last-child {
			padding-bottom: 12px;
		}

		.terminal-segment.segment-continues .step-block:last-child {
			padding-bottom: 0;
		}

		.terminal-segment.segment-continuation .step-block:first-child {
			padding-top: 0;
		}

		.terminal-segment.segment-continues::after {
			content: '';
			position: absolute;
			bottom: -24px;
			left: -1px;
			right: -1px;
			height: 24px;
			background: linear-gradient(to bottom, var(--bg-terminal), transparent);
			border-left: 1px solid var(--border-subtle);
			border-right: 1px solid var(--border-subtle);
			pointer-events: none;
			z-index: 1;
		}

		.terminal-segment.segment-continuation::before {
			content: '';
			position: absolute;
			top: -24px;
			left: -1px;
			right: -1px;
			height: 24px;
			background: linear-gradient(to top, var(--bg-terminal), transparent);
			border-left: 1px solid var(--border-subtle);
			border-right: 1px solid var(--border-subtle);
			pointer-events: none;
			z-index: 1;
		}

		.segment-titlebar {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 8px 12px;
			margin-bottom: 10px;
			background: var(--bg-hover);
			border-bottom: 1px solid var(--glass-faint);
		}

		.segment-dot {
			width: 10px;
			height: 10px;
			border-radius: 50%;
		}

		.segment-dot--red { background: var(--dot-red); opacity: 0.4; }
		.segment-dot--yellow { background: var(--dot-yellow); opacity: 0.4; }
		.segment-dot--green { background: var(--dot-green); opacity: 0.4; }

		.segment-title {
			font-family: var(--font-mono);
			font-size: 11px;
			font-weight: 500;
			color: var(--text-tertiary);
			margin-left: 4px;
		}

		.inline-comment {
			display: block;
			margin: 16px 12px;
			padding: 16px 20px;
			background: var(--glass-bg-soft);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border-radius: 12px;
			border: 1px solid var(--border-color);
		}

		.inline-comment__label {
			font-size: 9px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 1px;
			color: var(--orange-300);
			margin-bottom: 6px;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.inline-comment__label::after {
			content: '';
			flex: 1;
			height: 1px;
			background: linear-gradient(90deg, var(--orange-300), transparent);
			opacity: 0.2;
		}

		.inline-comment__text {
			font-family: var(--font-display);
			font-size: 13px;
			line-height: 1.6;
			color: var(--text-secondary);
		}

		.inline-comment__text :global(strong) {
			color: var(--text-primary);
			font-weight: 700;
		}

		.inline-comment__text :global(code) {
			font-family: var(--font-mono);
			font-size: 12px;
			background: var(--accent-soft);
			color: var(--peach);
			padding: 1px 5px;
			border-radius: 3px;
		}
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
			background: transparent !important;
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
			background: transparent;
		}

		/* Content flows naturally — no internal scroll container */
		.terminal-body {
			padding: 8px 20px;
			font-size: 12px;
			line-height: 1.6;
			overflow: visible;
			flex: 0 0 auto;
			background: transparent;
		}

		.step-block {
			padding: 0 14px;
		}

		/* Hide spacers — content flows naturally */
		.terminal-spacer { display: none; }
	}

	@media (max-width: 480px) {
		.terminal-body { padding: 6px 12px; font-size: 11px; line-height: 1.55; }
	}
</style>
