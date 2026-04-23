<!--
	Bottom taskbar — clickable indicators for the terminal + each desktop window.
	Hidden on mobile (<=900px) since the timeline is inline there.

	Progressive collapse:
	  1. Full labels (icon + text)
	  2. Icon-only (when items overflow)
	  3. Paginated with ‹/› arrows (when icons still overflow)
-->
<script lang="ts">
	import { getWindowIcon, type WindowStep } from '$lib/data/tutorials';

	let {
		windowSteps,
		currentStep,
		getStackClass,
		onJump
	}: {
		windowSteps: { step: WindowStep; index: number }[];
		currentStep: number;
		getStackClass: (winIndex: number) => string;
		onJump: (stepIndex: number) => void;
	} = $props();

	let taskbarRef = $state<HTMLElement | null>(null);
	let innerRef = $state<HTMLElement | null>(null);

	type CollapseMode = 'full' | 'icons' | 'paginated';
	let mode = $state<CollapseMode>('full');
	let pageStart = $state(0);
	const PAGE_SIZE = 16;

	// total items = 1 (terminal) + windowSteps.length
	let totalItems = $derived(1 + windowSteps.length);

	let pageEnd = $derived(Math.min(pageStart + PAGE_SIZE, totalItems));
	let canPrev = $derived(pageStart > 0);
	let canNext = $derived(pageEnd < totalItems);

	// All items: terminal first, then windows
	type TaskbarEntry = { kind: 'terminal' } | { kind: 'window'; win: { step: WindowStep; index: number }; idx: number };
	let allItems = $derived<TaskbarEntry[]>([
		{ kind: 'terminal' },
		...windowSteps.map((win, idx) => ({ kind: 'window' as const, win, idx }))
	]);

	let visibleItems = $derived(
		mode === 'paginated' ? allItems.slice(pageStart, pageEnd) : allItems
	);

	function measureOverflow() {
		if (!taskbarRef || !innerRef) return;
		const available = taskbarRef.clientWidth - 40; // padding
		// Reset to full to measure
		mode = 'full';
		// Use rAF to measure after DOM update
		requestAnimationFrame(() => {
			if (!innerRef) return;
			if (innerRef.scrollWidth > available) {
				mode = 'icons';
				requestAnimationFrame(() => {
					if (!innerRef) return;
					if (innerRef.scrollWidth > available) {
						mode = 'paginated';
						// Ensure active item is in view
						snapPageToActive();
					}
				});
			}
		});
	}

	function snapPageToActive() {
		const activeIdx = allItems.findIndex(item => {
			if (item.kind === 'terminal') return false;
			return item.win.index <= currentStep && getStackClass(item.idx) === 'stack-0';
		});
		if (activeIdx >= 0 && (activeIdx < pageStart || activeIdx >= pageStart + PAGE_SIZE)) {
			pageStart = Math.max(0, Math.min(activeIdx - Math.floor(PAGE_SIZE / 2), totalItems - PAGE_SIZE));
		}
	}

	function pagePrev() { pageStart = Math.max(0, pageStart - PAGE_SIZE); }
	function pageNext() { pageStart = Math.min(totalItems - PAGE_SIZE, pageStart + PAGE_SIZE); }

	$effect(() => {
		// Re-measure when window list changes
		void windowSteps.length;
		measureOverflow();
	});

	// Also observe resize
	$effect(() => {
		if (!taskbarRef) return;
		const ro = new ResizeObserver(() => measureOverflow());
		ro.observe(taskbarRef);
		return () => ro.disconnect();
	});
</script>

<div class="taskbar" bind:this={taskbarRef}>
	{#if mode === 'paginated' && canPrev}
		<button type="button" class="page-arrow" onclick={pagePrev} title="Previous windows">&#8249;</button>
	{/if}

	<div class="taskbar-inner" class:icons-only={mode !== 'full'} bind:this={innerRef}>
		{#each visibleItems as item}
			{#if item.kind === 'terminal'}
				<button
					type="button"
					class="taskbar-item active"
					class:icon-only={mode !== 'full'}
					onclick={() => onJump(-1)}
					title={mode !== 'full' ? 'Terminal' : undefined}
				>
					<div class="taskbar-icon terminal">&#8250;_</div>
					{#if mode === 'full'}<span>Terminal</span>{/if}
				</button>
			{:else}
				<button
					type="button"
					class="taskbar-item"
					class:icon-only={mode !== 'full'}
					class:visible-item={item.win.index <= currentStep}
					class:active={item.win.index <= currentStep && getStackClass(item.idx) === 'stack-0'}
					onclick={() => onJump(item.win.index)}
					title={mode !== 'full' ? item.win.step.windowTitle : undefined}
				>
					<div class="taskbar-icon fiji">{item.win.step.icon ?? getWindowIcon(item.win.step.content)}</div>
					{#if mode === 'full'}<span>{item.win.step.windowTitle}</span>{/if}
				</button>
			{/if}
		{/each}
	</div>

	{#if mode === 'paginated' && canNext}
		<button type="button" class="page-arrow" onclick={pageNext} title="More windows">&#8250;</button>
	{/if}
</div>

<style>
	.taskbar {
		height: 44px;
		background: rgba(28, 16, 23, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-top: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 0 20px;
		z-index: 100;
		flex-shrink: 0;
		overflow: hidden;
	}

	.taskbar-inner {
		display: flex;
		align-items: center;
		gap: 4px;
		overflow: hidden;
	}

	.taskbar-item {
		background: none;
		border: none;
		font-family: inherit;
		height: 34px;
		padding: 0 14px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: background 0.15s, opacity 0.3s;
		white-space: nowrap;
		opacity: 0.35;
		flex-shrink: 0;
	}

	.taskbar-item.icon-only {
		padding: 0 6px;
		gap: 0;
	}

	.taskbar-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.taskbar-item.visible-item {
		opacity: 0.7;
	}

	.taskbar-item.active {
		background: rgba(233, 84, 32, 0.12);
		color: var(--text-primary);
		opacity: 1;
	}

	.taskbar-icon {
		width: 18px;
		height: 18px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 700;
	}

	.taskbar-icon.terminal { background: #241a20; color: var(--accent); }
	.taskbar-icon.fiji { background: var(--bg-hover); color: var(--text-secondary); }

	/* ─── Pagination arrows ─── */
	.page-arrow {
		background: none;
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 16px;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;
	}

	.page-arrow:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	@media (max-width: 900px) {
		.taskbar { display: none; }
	}
</style>
