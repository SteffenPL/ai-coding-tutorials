<script lang="ts">
	import type { WindowCollectionContent, WindowCollectionEntry } from '$lib/data/tutorials';
	import { getWindowIcon } from '$lib/data/tutorials';
	import WindowChrome from './WindowChrome.svelte';
	import WindowContent from './WindowContent.svelte';

	let { content }: { content: WindowCollectionContent } = $props();
	let maximized = $state<WindowCollectionEntry | null>(null);

	function isMediaEntry(entry: WindowCollectionEntry): boolean {
		return entry.content.kind === 'fiji-image' || entry.content.kind === 'image' || entry.content.kind === 'video';
	}

	function hasStatusBar(entry: WindowCollectionEntry): boolean {
		return entry.content.kind === 'fiji-image' && !!entry.content.statusBar;
	}

	function fitMediaWindow(node: HTMLElement) {
		if (!node.classList.contains('media-sub-window')) return {};

		let resizeObserver: ResizeObserver | null = null;

		const update = () => {
			const media = node.querySelector<HTMLImageElement | HTMLVideoElement>('img, video');
			if (!media) return;

			const naturalWidth = media instanceof HTMLImageElement ? media.naturalWidth : media.videoWidth;
			const naturalHeight = media instanceof HTMLImageElement ? media.naturalHeight : media.videoHeight;
			if (!naturalWidth || !naturalHeight) return;

			const headerHeight = node.querySelector<HTMLElement>('.window-header')?.offsetHeight ?? 0;
			const statusHeight = node.querySelector<HTMLElement>('.statusbar')?.offsetHeight ?? 0;
			const frame = node.parentElement;
			const frameRect = frame?.getBoundingClientRect();
			const isMaximized = node.classList.contains('max-sub-window');
			const availableWidth = Math.max(
				1,
				(isMaximized ? window.innerWidth - 44 : (frameRect?.width ?? window.innerWidth)) - 2
			);
			const availableHeight = Math.max(
				1,
				(isMaximized ? window.innerHeight - 96 : (frameRect?.height ?? window.innerHeight)) -
					headerHeight -
					statusHeight -
					2
			);
			const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
			const mediaWidth = Math.floor(naturalWidth * scale);
			const mediaHeight = Math.floor(naturalHeight * scale);

			node.style.setProperty('--fit-media-width', `${mediaWidth}px`);
			node.style.setProperty('--fit-media-height', `${mediaHeight}px`);
			node.style.setProperty('--fit-status-height', `${statusHeight}px`);
		};

		const media = node.querySelector<HTMLImageElement | HTMLVideoElement>('img, video');
		media?.addEventListener('load', update);
		media?.addEventListener('loadedmetadata', update);
		window.addEventListener('resize', update);
		resizeObserver = new ResizeObserver(update);
		if (node.parentElement) resizeObserver.observe(node.parentElement);
		update();

		return {
			destroy() {
				media?.removeEventListener('load', update);
				media?.removeEventListener('loadedmetadata', update);
				window.removeEventListener('resize', update);
				resizeObserver?.disconnect();
			}
		};
	}
</script>

<div
	class="collection-grid"
	style="--cols: {content.cols}; --rows: {content.rows};"
>
	{#each content.windows as entry, i}
		<div class="collection-cell">
			<div
				class="sub-window"
				class:media-sub-window={isMediaEntry(entry)}
				class:has-status-bar={hasStatusBar(entry)}
				style="--delay: {i * 80}ms;"
				use:fitMediaWindow
			>
				<WindowChrome
					title={entry.title}
					subtitle={entry.subtitle}
					icon={getWindowIcon(entry.content)}
					onMaximize={() => { maximized = entry; }}
				/>
				<div class="sub-body">
					<WindowContent content={entry.content} />
				</div>
			</div>
		</div>
	{/each}
</div>

{#if maximized}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="max-backdrop" onclick={() => { maximized = null; }}></div>
	<div
		class="max-sub-window"
		class:media-sub-window={isMediaEntry(maximized)}
		class:has-status-bar={hasStatusBar(maximized)}
		use:fitMediaWindow
	>
		<WindowChrome
			title={maximized.title}
			subtitle={maximized.subtitle}
			icon={getWindowIcon(maximized.content)}
			isMaximized
			onRestore={() => { maximized = null; }}
		/>
		<div class="max-sub-body">
			<WindowContent content={maximized.content} />
		</div>
	</div>
{/if}

<style>
	.collection-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		gap: 6px;
		justify-content: center;
		align-content: center;
		width: 100%;
		height: 100%;
	}

	.collection-cell {
		min-width: 0;
		min-height: 0;
		display: flex;
		align-items: stretch;
		justify-content: stretch;
	}

	.sub-window {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-secondary);
		box-shadow: var(--card-shadow);
		animation: sub-appear 0.35s ease both;
		animation-delay: var(--delay);
	}

	.media-sub-window {
		align-self: center;
		width: calc(var(--fit-media-width, 0px) + 2px);
		height: auto;
		max-width: 100%;
		max-height: 100%;
	}

	@keyframes sub-appear {
		from {
			opacity: 0;
			transform: scale(0.88) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.sub-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: #000;
	}

	.media-sub-window .sub-body {
		flex: 0 1 auto;
		width: var(--fit-media-width, auto);
		height: calc(var(--fit-media-height, 0px) + var(--fit-status-height, 0px));
	}

	/* Override ZoomableView scoped styles — !important needed to beat
	   the Svelte hash-scoped selectors on .zoom-container/.zoom-content */
	.sub-body :global(.zoom-container) {
		display: flex !important;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.media-sub-window .sub-body :global(.zoom-container) {
		display: block !important;
		width: var(--fit-media-width, auto);
		height: var(--fit-media-height, auto);
	}

	.sub-body :global(.zoom-content) {
		display: contents !important;
	}

	.media-sub-window .sub-body :global(.zoom-content) {
		display: block !important;
		width: auto;
		height: auto;
	}

	.sub-body :global(img) {
		display: block;
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		image-rendering: auto;
	}

	.media-sub-window .sub-body :global(img),
	.media-sub-window .sub-body :global(video) {
		display: block;
		width: var(--fit-media-width, auto);
		height: var(--fit-media-height, auto);
		object-fit: contain;
	}

	/* ── Sub-window maximize overlay ── */
	/* Fixed to viewport, offset by nav height (56px) to cover terminal + desktop */
	.max-backdrop {
		position: fixed;
		inset: 0;
		background: var(--overlay-bg);
		z-index: 300;
	}

	.max-sub-window {
		position: fixed;
		top: 74px;
		left: 22px;
		right: 22px;
		bottom: 22px;
		z-index: 310;
		display: flex;
		flex-direction: column;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-secondary);
		box-shadow: var(--shadow-xl);
		animation: maxPopIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.max-sub-window.media-sub-window {
		top: 50%;
		left: 50%;
		right: auto;
		bottom: auto;
		width: calc(var(--fit-media-width, 0px) + 2px);
		height: auto;
		max-width: calc(100vw - 44px);
		max-height: calc(100vh - 96px);
		transform: translate(-50%, -50%);
		animation: maxMediaPopIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes maxPopIn {
		from { opacity: 0; transform: scale(0.97); }
		to { opacity: 1; transform: scale(1); }
	}

	@keyframes maxMediaPopIn {
		from { opacity: 0; transform: translate(-50%, -50%) scale(0.97); }
		to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}

	.max-sub-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
	}

	.max-sub-window.media-sub-window .max-sub-body {
		flex: 0 1 auto;
		display: block;
		width: var(--fit-media-width, auto);
		height: calc(var(--fit-media-height, 0px) + var(--fit-status-height, 0px));
	}

	.max-sub-body :global(.zoom-container) {
		flex: 1 1 auto;
		min-height: 0;
	}

	.max-sub-window.media-sub-window .max-sub-body :global(.zoom-container) {
		display: block;
		width: var(--fit-media-width, auto);
		height: var(--fit-media-height, auto);
	}

	.max-sub-body :global(.zoom-content) {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.max-sub-window.media-sub-window .max-sub-body :global(.zoom-content) {
		display: block;
		width: auto;
		height: auto;
	}

	.max-sub-body :global(img),
	.max-sub-body :global(video) {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	.max-sub-window.media-sub-window .max-sub-body :global(img),
	.max-sub-window.media-sub-window .max-sub-body :global(video) {
		display: block;
		width: var(--fit-media-width, auto);
		height: var(--fit-media-height, auto);
		object-fit: contain;
	}

	@media (max-width: 900px) {
		.max-sub-window {
			top: 57px;
			left: 6px;
			right: 6px;
			bottom: 121px;
		}

		.max-sub-window.media-sub-window {
			top: 50%;
			left: 50%;
			right: auto;
			bottom: auto;
			max-width: calc(100vw - 12px);
			max-height: calc(100dvh - 178px);
		}
	}
</style>
