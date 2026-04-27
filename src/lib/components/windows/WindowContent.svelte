<!--
	Window content dispatcher.
	Renders the inner content of a desktop window based on the content kind.
	Used by both the desktop stacked view and the mobile inline view.

	To add a new window type:
	1. Add a content interface + kind to WindowContentData in tutorials.ts
	2. Create a [Kind]View.svelte component
	3. Add a {:else if} branch below
-->
<script lang="ts">
	import type { WindowContentData } from '$lib/data/tutorials';
	import FijiImageView from './FijiImageView.svelte';
	import FijiMainView from './FijiMainView.svelte';
	import ImageView from './ImageView.svelte';
	import MarkdownView from './MarkdownView.svelte';
	import SourceView from './SourceView.svelte';
	import FolderView from './FolderView.svelte';
	import VideoView from './VideoView.svelte';
	import WindowCollectionView from './WindowCollectionView.svelte';

	let { content }: { content: WindowContentData } = $props();
</script>

{#if content.kind === 'fiji-image'}
	<FijiImageView {content} />
{:else if content.kind === 'fiji-main'}
	<FijiMainView {content} />
{:else if content.kind === 'image'}
	<ImageView {content} />
{:else if content.kind === 'markdown'}
	<MarkdownView {content} />
{:else if content.kind === 'source'}
	<SourceView {content} />
{:else if content.kind === 'folder'}
	<FolderView {content} />
{:else if content.kind === 'video'}
	<VideoView {content} />
{:else if content.kind === 'window-collection'}
	<WindowCollectionView {content} />
{/if}
