<!--
	Window chrome — title bar with traffic-light dots.
	Single source of truth for chrome markup + styling. Used by:
	- the terminal window
	- the desktop Fiji window stack
	- the inline mobile window
	- the maximize overlay
	- the session log round windows

	Design rules:
	- Close is ALWAYS decorative (grayed).
	- Minimize is decorative by default. Pass `onMinimize` (+ optional
	  `isMinimized` + `onRestoreMin`) to make it interactive — the dot then
	  turns yellow and toggles a collapsed/expanded state supplied by the
	  caller. Used by the session-log round windows to collapse a round.
	- Maximize is interactive when `onMaximize` / `onRestore` are provided.
	- `isMaximized` flips the maximize glyph (corners → restore squares).
-->
<script lang="ts">
	let {
		title,
		subtitle,
		icon,
		variant = 'secondary',
		isMaximized = false,
		onMaximize,
		onRestore,
		isMinimized = false,
		onMinimize,
		onRestoreMin,
		onHeaderClick
	}: {
		title: string;
		subtitle?: string;
		/** HTML string for the icon (allows entities like &#8250;_) */
		icon?: string;
		/** 'primary' = accent-colored icon (terminal), 'secondary' = subtle (default) */
		variant?: 'primary' | 'secondary';
		isMaximized?: boolean;
		onMaximize?: () => void;
		onRestore?: () => void;
		/** When true, the minimize dot shows a restore glyph. */
		isMinimized?: boolean;
		/** Optional: makes the minimize dot interactive (yellow). */
		onMinimize?: () => void;
		/** Optional: called when clicking the minimize dot while `isMinimized`. Falls back to `onMinimize`. */
		onRestoreMin?: () => void;
		/** Optional: makes the header itself clickable (e.g. to jump timeline to this window). Traffic-light dots stopPropagation. */
		onHeaderClick?: () => void;
	} = $props();

	const canMaximize = $derived(isMaximized ? !!onRestore : !!onMaximize);
	const canMinimize = $derived(isMinimized ? !!onRestoreMin || !!onMinimize : !!onMinimize);

	function toggleMax() {
		if (isMaximized) onRestore?.();
		else onMaximize?.();
	}

	function toggleMin() {
		if (isMinimized) (onRestoreMin ?? onMinimize)?.();
		else onMinimize?.();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="window-header"
	class:clickable={!!onHeaderClick}
	onclick={onHeaderClick}
>
	<div class="window-title">
		{#if icon}
			<span class="window-icon" class:primary={variant === 'primary'}>{@html icon}</span>
		{/if}
		<span class="title-text">{title}</span>
		{#if subtitle}
			<span class="subtitle">{subtitle}</span>
		{/if}
	</div>
	<div class="window-buttons">
		<!-- minimize: decorative unless onMinimize is provided -->
		{#if canMinimize}
			<button
				type="button"
				class="dot minimize active"
				class:is-minimized={isMinimized}
				aria-label={isMinimized ? 'Restore window' : 'Minimize window'}
				onclick={(e) => { e.stopPropagation(); toggleMin(); }}
			>
				{#if isMinimized}
					<!-- Restore from minimized: caret down -->
					<svg viewBox="0 0 10 10" aria-hidden="true">
						<path d="M2.5 4 L5 6.5 L7.5 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				{:else}
					<!-- Minimize: a single horizontal bar -->
					<svg viewBox="0 0 10 10" aria-hidden="true">
						<path d="M2.5 5.5 H7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
					</svg>
				{/if}
			</button>
		{:else}
			<span class="dot decorative" aria-hidden="true"></span>
		{/if}
		<!-- maximize / restore -->
		<button
			type="button"
			class="dot maximize"
			class:active={canMaximize}
			class:is-maximized={isMaximized}
			aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
			disabled={!canMaximize}
			onclick={(e) => { e.stopPropagation(); toggleMax(); }}
		>
			{#if isMaximized}
				<!-- Restore (two overlapping squares) -->
				<svg viewBox="0 0 10 10" aria-hidden="true">
					<rect x="2" y="3" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1" />
					<path d="M3.5 3 V2 H8 V6.5 H7" fill="none" stroke="currentColor" stroke-width="1" />
				</svg>
			{:else}
				<!-- Maximize (corner arrows) -->
				<svg viewBox="0 0 10 10" aria-hidden="true">
					<path d="M2.5 4 V2.5 H4 M6 2.5 H7.5 V4 M7.5 6 V7.5 H6 M4 7.5 H2.5 V6" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
				</svg>
			{/if}
		</button>
		<!-- close — decorative only -->
		<span class="dot decorative" aria-hidden="true"></span>
	</div>
</div>

<style>
	.window-header {
		height: 30px;
		background: var(--bg-hover);
		display: flex;
		align-items: center;
		padding: 0 10px;
		gap: 7px;
		flex-shrink: 0;
		user-select: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		transition: background-color 0.15s;
	}

	.window-header.clickable {
		cursor: pointer;
	}

	.window-header.clickable:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.window-title {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		flex: 1;
		font-family: var(--font-display);
	}

	.title-text {
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 700;
	}

	.window-icon {
		font-size: 11px;
		font-weight: 700;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-tertiary);
	}

	.window-icon.primary {
		color: var(--accent);
	}

	.subtitle {
		font-size: 10px;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		margin-left: 4px;
		font-weight: 400;
	}

	.window-buttons {
		display: flex;
		gap: 7px;
		align-items: center;
		margin-left: auto;
	}

	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		transition: background-color 0.15s, filter 0.15s;
	}

	/* close + minimize — never interactive */
	.decorative {
		background: var(--border-subtle);
		opacity: 0.55;
	}

	/* maximize/restore */
	button.maximize {
		background: var(--border-subtle);
		opacity: 0.55;
		cursor: not-allowed;
		color: rgba(0, 0, 0, 0.7);
	}

	button.maximize.active {
		background: var(--green);
		opacity: 1;
		cursor: pointer;
	}

	button.maximize.active:hover {
		filter: brightness(1.15);
	}

	button.maximize svg {
		width: 7.5px;
		height: 7.5px;
		opacity: 0;
		transition: opacity 0.12s;
	}

	/* glyph revealed on hover of active button */
	button.maximize.active:hover svg {
		opacity: 1;
	}

	/* minimize — activated by caller (e.g. session-log round windows) */
	button.minimize {
		background: var(--border-subtle);
		opacity: 0.55;
		cursor: not-allowed;
		color: rgba(0, 0, 0, 0.7);
	}
	button.minimize.active {
		background: #f0b030; /* macOS yellow */
		opacity: 1;
		cursor: pointer;
	}
	button.minimize.active:hover {
		filter: brightness(1.15);
	}
	button.minimize svg {
		width: 7.5px;
		height: 7.5px;
		opacity: 0;
		transition: opacity 0.12s;
	}
	button.minimize.active:hover svg {
		opacity: 1;
	}
</style>
