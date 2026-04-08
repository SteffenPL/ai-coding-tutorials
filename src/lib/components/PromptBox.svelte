<script lang="ts">
	import { t } from '$lib/stores/lang.svelte';

	interface Props {
		body: string;
	}

	let { body }: Props = $props();
	let copied = $state(false);

	function copyPrompt() {
		navigator.clipboard.writeText(body).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}
</script>

<div class="prompt-box">
	<div class="prompt-box__header">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
		</svg>
		{t({ en: 'Try this prompt', ja: 'このプロンプトを試してみましょう' })}
		<button class="prompt-box__copy" class:copied onclick={copyPrompt}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<rect x="9" y="9" width="13" height="13" rx="2" />
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
			</svg>
			{copied ? t({ en: 'Copied!', ja: 'コピー済み' }) : t({ en: 'Copy', ja: 'コピー' })}
		</button>
	</div>
	<div class="prompt-box__content">{body}</div>
</div>

<style>
	.prompt-box {
		margin: 24px 0;
		border-radius: 10px;
		border: 1px solid var(--prompt-border);
		border-left: 4px solid var(--shark);
		background: var(--prompt-bg);
		overflow: hidden;
		transition: all var(--transition-theme);
	}

	.prompt-box__header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--prompt-border);
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--shark);
	}

	.prompt-box__header svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.prompt-box__copy {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--shark-tag-text);
		background: transparent;
		border: 1px solid var(--shark-tag-border);
		border-radius: 5px;
		padding: 2px 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.prompt-box__copy:hover {
		background: var(--shark);
		color: #ffffff;
		border-color: var(--shark);
	}

	.prompt-box__copy.copied {
		background: #2ea043;
		color: #ffffff;
		border-color: #2ea043;
	}

	.prompt-box__copy svg {
		width: 10px;
		height: 10px;
	}

	.prompt-box__content {
		padding: 14px 16px;
		font-family: var(--font-mono);
		font-size: 0.84rem;
		line-height: 1.65;
		color: var(--prompt-text);
		white-space: pre-wrap;
	}
</style>
