<!--
	Zoomable content wrapper. Wraps any media so it gains:
	- Ctrl/Cmd + wheel → zoom (desktop). Plain wheel is left alone so page
	  scroll / internal scroll still works.
	- Click-drag → pan when zoomed (desktop + mobile).
	- Floating bottom-right controls: −  %  +  — always tappable on mobile.
	- Pinch is intentionally NOT supported (keeps the component simple;
	  mobile users rely on the buttons).

	Layout model:
	- Outer `.zoom-container` has `overflow: hidden`. It takes its size from
	  the inner content, so the window auto-sizes to the media's natural
	  aspect, just as before the refactor.
	- Inner `.zoom-content` carries the transform. Because `transform`
	  happens AFTER layout, scaling it up doesn't expand the container —
	  overflow is clipped, which gives the zoom effect for free.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let scale = $state(1);
	let panX = $state(0);
	let panY = $state(0);

	let containerEl = $state<HTMLDivElement>();
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartPanX = 0;
	let dragStartPanY = 0;

	const MIN = 0.5;
	const MAX = 8;
	const STEP = 1.35;

	function setScale(next: number) {
		const clamped = Math.max(MIN, Math.min(MAX, next));
		scale = clamped;
		if (clamped <= 1) {
			panX = 0;
			panY = 0;
		}
	}

	function onWheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey)) return; // plain wheel reserved for scroll
		e.preventDefault();
		// Exponential so each notch feels equally-weighted regardless of current zoom
		const factor = Math.exp(-e.deltaY * 0.003);
		setScale(scale * factor);
	}

	function zoomIn() {
		setScale(scale * STEP);
	}
	function zoomOut() {
		setScale(scale / STEP);
	}
	function reset() {
		scale = 1;
		panX = 0;
		panY = 0;
	}

	function onPointerDown(e: PointerEvent) {
		if (scale <= 1) return; // only pan when zoomed
		if (e.button !== 0) return;
		// Don't hijack clicks on the zoom controls — pointer capture would
		// steal the subsequent click event from the button.
		if ((e.target as HTMLElement | null)?.closest('.zoom-controls')) return;
		dragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartPanX = panX;
		dragStartPanY = panY;
		containerEl?.setPointerCapture(e.pointerId);
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		panX = dragStartPanX + (e.clientX - dragStartX);
		panY = dragStartPanY + (e.clientY - dragStartY);
	}
	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		try {
			containerEl?.releasePointerCapture(e.pointerId);
		} catch {
			// no-op: capture may already be released
		}
	}

	const transformStyle = $derived(
		`transform: translate(${panX}px, ${panY}px) scale(${scale});`
	);
	const cursorStyle = $derived(scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default');
	const percent = $derived(Math.round(scale * 100));
	const zoomed = $derived(scale !== 1);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="zoom-container"
	bind:this={containerEl}
	style:cursor={cursorStyle}
	onwheel={onWheel}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	<div class="zoom-content" style={transformStyle}>
		{@render children()}
	</div>

	<div class="zoom-controls" class:visible={zoomed}>
		<button type="button" aria-label="Zoom out" onclick={zoomOut} disabled={scale <= MIN}>
			−
		</button>
		<button
			type="button"
			class="pct"
			aria-label="Reset zoom"
			onclick={reset}
			disabled={!zoomed}
			title={zoomed ? 'Reset zoom' : ''}
		>
			{percent}%
		</button>
		<button type="button" aria-label="Zoom in" onclick={zoomIn} disabled={scale >= MAX}>
			+
		</button>
	</div>
</div>

<style>
	.zoom-container {
		position: relative;
		overflow: hidden;
		display: block;
		min-height: 0;
		/* touch-action: none would kill native scrolling on mobile — we only
		   disable it for the content wrapper when actively panning */
	}

	.zoom-content {
		transform-origin: center center;
		will-change: transform;
		display: block;
	}

	/* Bottom-right floating controls */
	.zoom-controls {
		position: absolute;
		bottom: 8px;
		right: 8px;
		z-index: 4;
		display: inline-flex;
		align-items: center;
		background: rgba(44, 0, 30, 0.82);
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		padding: 2px;
		opacity: 0;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition: opacity 0.15s ease;
		user-select: none;
	}

	/* Hover to reveal; always visible once zoomed (so user can find the reset) */
	.zoom-container:hover .zoom-controls,
	.zoom-container:focus-within .zoom-controls,
	.zoom-controls.visible {
		opacity: 1;
	}

	.zoom-controls button {
		min-width: 24px;
		height: 22px;
		padding: 0 6px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		border-radius: 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 0.12s, color 0.12s;
	}

	.zoom-controls button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.zoom-controls button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.zoom-controls .pct {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 500;
		color: var(--text-tertiary);
		min-width: 40px;
	}

	/* On mobile, make the controls always visible + slightly larger targets */
	@media (max-width: 900px) {
		.zoom-controls {
			opacity: 1;
		}
		.zoom-controls button {
			min-width: 30px;
			height: 28px;
			font-size: 15px;
		}
		.zoom-controls .pct {
			font-size: 11px;
		}
	}
</style>
