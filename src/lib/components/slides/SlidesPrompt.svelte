<script lang="ts">
	let { text, kind = 'claude' }: { text: string; kind?: 'claude' | 'terminal' } = $props();
</script>

<div class="slides-prompt" class:terminal={kind === 'terminal'}>
	<span class="slides-prompt__chevron">
		{kind === 'terminal' ? '$' : '›'}
	</span>
	<div class="slides-prompt__text">{text}</div>
</div>

<style>
	.slides-prompt {
		display: flex;
		gap: 16px;
		padding: 24px 28px;
		border-radius: 12px;
		background: rgba(233, 84, 32, 0.08);
		border-left: 4px solid var(--orange-400, #E95420);
		font-size: 1.15rem;
		line-height: 1.5;
		color: var(--text-primary);
		font-family: var(--font-mono);
	}

	.slides-prompt.terminal {
		background: rgba(77, 175, 124, 0.08);
		border-left-color: var(--green, #4DAF7C);
	}

	.slides-prompt__chevron {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--orange-400, #E95420);
		flex-shrink: 0;
		line-height: 1.4;
	}

	.terminal .slides-prompt__chevron {
		color: var(--green, #4DAF7C);
	}

	.slides-prompt__text {
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
