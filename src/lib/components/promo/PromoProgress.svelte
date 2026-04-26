<script lang="ts">
	let { progress }: { progress: number } = $props();
</script>

<div class="promo-progress">
	<div class="promo-progress__fill" style="width: {progress * 100}%"></div>
</div>

<style>
	.promo-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		z-index: 1000;
		background: rgba(255, 255, 255, 0.06);
	}

	.promo-progress__fill {
		height: 100%;
		background: var(--orange-400, #E95420);
		box-shadow: 0 0 8px rgba(233, 84, 32, 0.5);
		transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
