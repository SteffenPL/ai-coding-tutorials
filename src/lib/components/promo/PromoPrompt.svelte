<script lang="ts">
	let { text, kind = 'claude' }: { text: string; kind?: 'claude' | 'terminal' } = $props();
</script>

<div class="promo-prompt" class:terminal={kind === 'terminal'}>
	<span class="promo-prompt__chevron">
		{kind === 'terminal' ? '$' : '›'}
	</span>
	<div class="promo-prompt__text">{text}</div>
</div>

<style>
	.promo-prompt {
		display: flex;
		gap: 16px;
		padding: 24px 28px;
		border-radius: 12px;
		background: rgba(233, 84, 32, 0.08);
		border-left: 4px solid var(--orange-400, #E95420);
		font-size: 1.35rem;
		line-height: 1.5;
		color: var(--text-primary);
		font-family: var(--font-mono);
	}

	.promo-prompt.terminal {
		background: rgba(77, 175, 124, 0.08);
		border-left-color: var(--green, #4DAF7C);
	}

	.promo-prompt__chevron {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--orange-400, #E95420);
		flex-shrink: 0;
		line-height: 1.4;
	}

	.terminal .promo-prompt__chevron {
		color: var(--green, #4DAF7C);
	}

	.promo-prompt__text {
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
