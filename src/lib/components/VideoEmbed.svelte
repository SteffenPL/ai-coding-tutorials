<script lang="ts">
	interface Props {
		url?: string;
	}

	let { url }: Props = $props();
</script>

<div class="video">
	<div class="video__wrap">
		{#if url}
			<iframe
				src={url}
				title="Tutorial video"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
			></iframe>
		{:else}
			<div class="video__placeholder">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="5,3 19,12 5,21" fill="currentColor" opacity="0.3" />
				</svg>
				<span>Video embed placeholder</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.video {
		margin-bottom: 28px;
		border-radius: 12px;
		overflow: hidden;
		background: var(--code-bg);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
	}

	.video__wrap {
		position: relative;
		width: 100%;
		padding-top: 56.25%;
	}

	.video__wrap iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.video__placeholder {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: var(--text-tertiary);
	}

	.video__placeholder svg {
		width: 48px;
		height: 48px;
		opacity: 0.4;
	}

	.video__placeholder span {
		font-size: 0.85rem;
		opacity: 0.5;
	}
</style>
