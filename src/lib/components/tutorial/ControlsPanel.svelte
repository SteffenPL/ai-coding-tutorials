<!--
	Bottom-of-right-column panel: tutorial comment (shown above) +
	playback controls (below). Renders its own wrapper.

	Mobile: the parent's `.right-column` goes `position: sticky; bottom: 0`,
	and here the order flips — controls on top, comment below — so the
	active controls stay close to the user's thumb.

	Settings popover state is owned by the parent ($bindable) because a
	document-level pointerdown dismisses it; that listener lives on the page.
-->
<script lang="ts">
	import ThemePicker from '$lib/components/ThemePicker.svelte';

	let {
		commentHtml,
		currentStep,
		currentRoundIdx,
		currentTutorialInRound,
		currentTutorialGlobal,
		totalTutorialStops,
		playing,
		detailMode = $bindable(),
		showSettings = $bindable(false),
		onPrev,
		onNext,
		onTogglePlay,
		onSetDetailMode
	}: {
		commentHtml: string;
		currentStep: number;
		currentRoundIdx: number;
		currentTutorialInRound: number;
		currentTutorialGlobal: number;
		totalTutorialStops: number;
		playing: boolean;
		detailMode: 'steps' | 'tutorial' | 'round';
		showSettings: boolean;
		onPrev: () => void;
		onNext: () => void;
		onTogglePlay: () => void;
		onSetDetailMode: (mode: 'steps' | 'tutorial' | 'round') => void;
	} = $props();
</script>

<div class="bottom-panel">
	<div class="comment-panel">
		<div class="comment-header">Tutorial ({currentTutorialGlobal + 1} / {totalTutorialStops})</div>
		<div class="comment-scroll">
			{#key commentHtml}
				<div class="comment-text comment-fade">
					{@html commentHtml}
				</div>
			{/key}
		</div>
	</div>

	<div class="controls">
		<div class="controls-left">
			<div class="settings-wrap">
				<button class="settings-btn" title="Detail level" onclick={() => (showSettings = !showSettings)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				</button>
				{#if showSettings}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="settings-popover" onpointerdown={(e) => e.stopPropagation()}>
						<span class="settings-label">Detail Level</span>
						<div class="detail-pills">
							{#each [['steps', 'Steps'], ['tutorial', 'Tutorial'], ['round', 'Round']] as const as [mode, label]}
								<button
									class="detail-pill"
									class:active={detailMode === mode}
									onclick={() => { onSetDetailMode(mode); showSettings = false; }}
								>
									{label}
								</button>
							{/each}
						</div>
						<div class="settings-divider"></div>
						<ThemePicker />
					</div>
				{/if}
			</div>
		</div>

		<div class="ctrl-nav">
			<button class="ctrl-btn" onclick={onPrev} title="Previous step">
				<span class="icon">&#8249;</span>
				<span class="ctrl-btn-label">Prev</span>
			</button>
			<button class="ctrl-btn" class:active={playing} onclick={onTogglePlay} title="Play / Pause">
				<span class="icon">{playing ? '\u2016' : '\u25B6'}</span>
				<span class="ctrl-btn-label">{playing ? 'Pause' : 'Play'}</span>
			</button>
			<button class="ctrl-btn" onclick={onNext} title="Next step">
				<span class="icon">&#8250;</span>
				<span class="ctrl-btn-label">Next</span>
			</button>
		</div>

		<div class="controls-right">
			<div class="step-counter">
				{#if currentStep < 0}
					<span class="counter-dim">0</span><span class="counter-dot">.</span><span class="counter-dim">0</span>
				{:else}
					<span class="current">{currentRoundIdx + 1}</span><span class="counter-dot">.</span><span class="counter-sub">{Math.max(0, currentTutorialInRound + 1)}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* ─── Wrapper ─── */
	.bottom-panel {
		flex: 0 0 auto;
		height: 33%;
		min-height: 200px;
		max-height: 400px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		overflow: hidden;
	}

	/* ─── Controls bar ─── */
	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--bg-surface);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid var(--border-color);
		border-radius: 10px;
	}

	.controls-left,
	.controls-right {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.controls-right {
		justify-content: flex-end;
		padding-right: 4px;
	}

	/* ─── Settings ─── */
	.settings-wrap {
		position: relative;
	}

	.settings-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s;
		padding: 0;
	}

	.settings-btn:hover {
		color: var(--text-primary);
	}

	.settings-btn svg {
		width: 16px;
		height: 16px;
	}

	.settings-popover {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		padding: 12px 14px;
		box-shadow: var(--shadow-lg);
		z-index: 50;
		white-space: nowrap;
		animation: popIn 0.15s ease-out;
	}

	@keyframes popIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.settings-label {
		display: block;
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--text-tertiary);
		margin-bottom: 8px;
	}

	.settings-divider {
		height: 1px;
		background: var(--border-subtle);
		margin: 10px 0;
	}

	/* ─── Nav buttons ─── */
	.ctrl-nav {
		display: flex;
		gap: 4px;
	}

	.ctrl-btn {
		width: 48px;
		padding: 5px 0 3px;
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		background: var(--bg-hover);
		color: var(--text-secondary);
		font-family: var(--font-display);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}

	.ctrl-btn:hover {
		background: var(--border-subtle);
		color: var(--text-primary);
	}

	.ctrl-btn.active {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}

	.ctrl-btn .icon {
		font-size: 16px;
		line-height: 1;
	}

	.ctrl-btn-label {
		font-size: 9px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		opacity: 0.7;
	}

	/* ─── Detail pills (inside popover) ─── */
	.detail-pills {
		display: flex;
		gap: 2px;
		background: var(--overlay-subtle);
		border-radius: 5px;
		padding: 2px;
	}

	.detail-pill {
		height: 26px;
		padding: 0 10px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-tertiary);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.detail-pill:hover {
		color: var(--text-secondary);
	}

	.detail-pill.active {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	/* ─── Step counter ─── */
	.step-counter {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	.step-counter .current {
		color: var(--accent);
		font-weight: 700;
	}

	.counter-dot {
		color: var(--text-tertiary);
		margin: 0 1px;
	}

	.counter-sub {
		color: var(--orange-300);
	}

	.counter-dim {
		color: var(--text-tertiary);
	}

	/* ─── Comment panel ─── */
	.comment-panel {
		padding: 14px 16px;
		background: var(--bg-surface);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.comment-scroll {
		flex: 1 1 0;
		min-height: 0;
		overflow-y: auto;
	}

	.comment-scroll::-webkit-scrollbar { width: 6px; }
	.comment-scroll::-webkit-scrollbar-track { background: transparent; }
	.comment-scroll::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 3px; }

	.comment-header {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--orange-300);
		margin-bottom: 8px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.comment-header::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, var(--orange-300), transparent);
		opacity: 0.2;
	}

	.comment-text {
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	.comment-fade {
		animation: commentFadeIn 50ms ease-out 0.15s both;
	}

	@keyframes commentFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.comment-text :global(strong) {
		color: var(--text-primary);
		font-weight: 700;
	}

	.comment-text :global(code) {
		font-family: var(--font-mono);
		font-size: 13px;
		background: var(--accent-soft);
		color: var(--peach);
		padding: 1px 5px;
		border-radius: 3px;
	}

	/* ─── Mobile: single unified sticky bar ─── */
	@media (max-width: 900px) {
		.bottom-panel {
			height: auto;
			min-height: 0;
			max-height: none;
			gap: 0;
			overflow: visible;
			background: var(--glass-bg-strong);
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
			border-top: 1px solid var(--border-color);
			border-radius: 10px 10px 0 0;
		}

		.comment-panel {
			order: 0;
			flex: none;
			border: none;
			border-radius: 0;
			background: transparent;
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			overflow: hidden;
			padding: 10px 14px 6px;
		}

		.comment-scroll {
			flex: none;
			max-height: 80px;
			overflow-y: auto;
		}

		.controls {
			order: 1;
			padding: 6px 12px 8px;
			gap: 6px;
			border: none;
			border-radius: 0;
			border-image: linear-gradient(90deg, var(--orange-300), transparent) 1;
			border-top: 1px solid;
			background: transparent;
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}

		.ctrl-btn { width: 40px; padding: 4px 0 2px; }
		.ctrl-btn .icon { font-size: 14px; }
		.ctrl-btn-label { font-size: 8px; }
		.step-counter { font-size: 10px; }
		.settings-btn svg { width: 14px; height: 14px; }

		.comment-header { margin-bottom: 4px; }
		.comment-text { font-size: 12px; line-height: 1.5; }
	}

	@media (max-width: 480px) {
		.controls { padding: 6px 10px; gap: 4px; flex-wrap: wrap; justify-content: center; }
		.step-counter { width: 100%; text-align: center; margin: 2px 0 0; }
		.comment-panel { padding: 6px 10px; }
		.controls-right { padding-right: 8px; }
	}
</style>
