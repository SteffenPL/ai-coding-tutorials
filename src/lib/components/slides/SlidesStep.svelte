<script lang="ts">
	import type { Snippet } from 'svelte';

	let { kind = 'step', children }: {
		kind?: 'prompt' | 'step' | 'window' | 'final';
		children: Snippet;
	} = $props();
</script>

<div class="slides-step slides-step--{kind}">
	{@render children()}
</div>

<style>
	.slides-step {
		animation: slidesFadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.slides-step--window {
		animation: slidesScaleIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.slides-step--final {
		animation: slidesFadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes slidesFadeUp {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes slidesScaleIn {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
</style>
