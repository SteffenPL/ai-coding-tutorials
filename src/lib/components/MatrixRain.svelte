<script lang="ts">
	import { browser } from '$app/environment';

	const prompts = [
		'segment',
		'cells.tif',
		'blur',
		'threshold',
		'napari',
		'contrast',
		'histogram',
		'conda',
		'SeqIO',
		'labels',
		'median',
		'gaussian',
		'outliers',
		'CSV',
		'Watershed',
		'Particles',
		'macro',
		'ROI',
		'gradient',
		'entropy',
		'kernel',
		'eigenvalue',
		'convex',
		'laplacian',
		'fourier',
		'hessian',
		'tensor',
		'sigmoid',
		'softmax',
		'jacobian',
		'divergence',
		'lattice',
		'iterate',
		'converge',
		'topology',
		'manifold',
		'細胞',
		'画像',
		'解析',
		'保存',
		'行列',
		'微分',
		'積分',
		'勾配',
		'収束',
		'確率',
		'関数',
		'変換',
		'次元',
		'空間',
		'最適化',
		'分布',
		'推定',
		'近似',
		'固有値',
	];

	interface Column {
		x: number;
		y: number;
		speed: number;
		opacity: number;
		originalChars: string[];
		resolveThreshold: number[];
		noiseState: string[];
	}

	function initColumn(x: number, startY: number): Column {
		const prompt = prompts[Math.floor(Math.random() * prompts.length)];
		const originalChars = prompt.split('');
		return {
			x,
			y: startY,
			speed: 0.7 + Math.random() * 1.0,
			opacity: 0.22 + Math.random() * 0.35,
			originalChars,
			resolveThreshold: makeResolveThresholds(originalChars.length),
			noiseState: originalChars.map(() => String(Math.round(Math.random()))),
		};
	}

	function makeResolveThresholds(length: number): number[] {
		const order = Array.from({ length }, (_, i) => i);
		for (let i = order.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		const thresholds = new Array<number>(length);
		for (let rank = 0; rank < length; rank++) {
			thresholds[order[rank]] = rank / length;
		}
		return thresholds;
	}

	let canvas = $state<HTMLCanvasElement>(null!);

	function setup(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d')!;
		let animId: number = 0;
		let columns: Column[] = [];
		const FONT_SIZE = 14;
		const CHAR_HEIGHT = FONT_SIZE + 2;

		function initColumns() {
			const dpr = window.devicePixelRatio || 1;
			const numCols = Math.floor(canvas.width / dpr / FONT_SIZE);
			columns = [];

			for (let i = 0; i < numCols; i++) {
				if (Math.random() > 0.30) continue;
				const x = i * FONT_SIZE;
				const startY = -Math.random() * canvas.height;
				columns.push(initColumn(x, startY));
			}
		}

		function resize() {
			const dpr = window.devicePixelRatio || 1;
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			ctx.scale(dpr, dpr);
			initColumns();
		}

		function draw() {
			const rect = canvas.getBoundingClientRect();
			const w = rect.width;
			const h = rect.height;

			ctx.clearRect(0, 0, w, h);

			const r = 233, g = 84, b = 32;
			ctx.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`;
			ctx.textBaseline = 'top';

			for (const col of columns) {
				col.y += col.speed;

				const len = col.originalChars.length;

				// Clarity trajectory: noise → readable (45%) → readable (75%) → noise again
				const centerY = col.y + (len * CHAR_HEIGHT) / 2;
				const progress = centerY / h;
				let clarity: number;
				if (progress < 0.45) {
					// Unscramble: 0→1 over 0%–45%
					clarity = Math.max(progress / 0.45, 0);
				} else if (progress < 0.75) {
					// Fully readable plateau
					clarity = 1;
				} else {
					// Re-scramble: 1→0 over 75%–100%
					clarity = Math.max(1 - (progress - 0.75) / 0.25, 0);
				}

				for (let i = 0; i < len; i++) {
					const charY = col.y + i * CHAR_HEIGHT;

					if (charY < -CHAR_HEIGHT || charY > h) continue;

					// ~2% chance per frame to flip → exponential wait, mean ~50 frames (~0.8s)
					if (Math.random() < 0.06) {
						col.noiseState[i] = col.noiseState[i] === '0' ? '1' : '0';
					}

					const ch = clarity >= col.resolveThreshold[i]
						? col.originalChars[i]
						: col.noiseState[i];

					const distFromBottom = len - 1 - i;
					let fade: number;
					if (distFromBottom === 0) {
						fade = 1.0;
					} else {
						fade = 1.0 - distFromBottom / len;
						fade = fade * fade;
					}

					const alpha = col.opacity * fade;
					if (alpha < 0.01) continue;

					ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
					ctx.fillText(ch, col.x, charY);
				}

				if (col.y > h) {
					Object.assign(col, initColumn(col.x, -(len * CHAR_HEIGHT) - Math.random() * h * 0.5));
				}
			}

			animId = requestAnimationFrame(draw);
		}

		resize();
		draw();

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas.parentElement!);

		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		if (motionQuery.matches) {
			cancelAnimationFrame(animId);
		}

		return {
			destroy() {
				cancelAnimationFrame(animId);
				resizeObserver.disconnect();
			}
		};
	}
</script>

{#if browser}
	<canvas
		bind:this={canvas}
		use:setup
		class="matrix-rain"
		aria-hidden="true"
	></canvas>
{/if}

<style>
	.matrix-rain {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}
</style>
