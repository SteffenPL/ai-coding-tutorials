<script lang="ts">
	import { themeStore, type WallpaperName } from '$lib/stores/theme.svelte';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';

	let canvas: HTMLCanvasElement | undefined = $state();
	let animId = 0;

	const wallpaper = $derived(themeStore.wallpaper);

	const isGradient = $derived(wallpaper.startsWith('mesh-'));
	const isDynamic = $derived(wallpaper.startsWith('dynamic-'));
	const isSolid = $derived(wallpaper.startsWith('solid-'));

	function startAnimation(wp: WallpaperName) {
		if (!canvas || !browser) return;
		cancelAnimationFrame(animId);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const resize = () => {
			canvas!.width = window.innerWidth;
			canvas!.height = window.innerHeight;
		};
		resize();
		window.addEventListener('resize', resize);

		if (wp === 'dynamic-aurora') {
			let t = 0;
			const draw = () => {
				t += 0.003;
				const w = canvas!.width;
				const h = canvas!.height;
				ctx.clearRect(0, 0, w, h);
				for (let i = 0; i < 5; i++) {
					const x = w * (0.2 + 0.15 * Math.sin(t + i * 1.2));
					const y = h * (0.3 + 0.2 * Math.cos(t * 0.7 + i * 0.8));
					const r = Math.max(w, h) * (0.3 + 0.1 * Math.sin(t * 0.5 + i));
					const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
					const hue = (180 + i * 40 + t * 10) % 360;
					gradient.addColorStop(0, `hsla(${hue}, 60%, 45%, 0.25)`);
					gradient.addColorStop(1, 'transparent');
					ctx.fillStyle = gradient;
					ctx.fillRect(0, 0, w, h);
				}
				animId = requestAnimationFrame(draw);
			};
			draw();
		} else if (wp === 'dynamic-particles') {
			const particles: { x: number; y: number; vx: number; vy: number; r: number; hue: number }[] = [];
			for (let i = 0; i < 60; i++) {
				particles.push({
					x: Math.random() * canvas.width,
					y: Math.random() * canvas.height,
					vx: (Math.random() - 0.5) * 0.3,
					vy: (Math.random() - 0.5) * 0.3,
					r: 2 + Math.random() * 3,
					hue: 15 + Math.random() * 30
				});
			}
			const draw = () => {
				const w = canvas!.width;
				const h = canvas!.height;
				ctx.clearRect(0, 0, w, h);
				for (const p of particles) {
					p.x += p.vx;
					p.y += p.vy;
					if (p.x < 0) p.x = w;
					if (p.x > w) p.x = 0;
					if (p.y < 0) p.y = h;
					if (p.y > h) p.y = 0;

					const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 20);
					gradient.addColorStop(0, `hsla(${p.hue}, 80%, 55%, 0.15)`);
					gradient.addColorStop(1, 'transparent');
					ctx.fillStyle = gradient;
					ctx.fillRect(p.x - p.r * 20, p.y - p.r * 20, p.r * 40, p.r * 40);
				}
				for (let i = 0; i < particles.length; i++) {
					for (let j = i + 1; j < particles.length; j++) {
						const dx = particles[i].x - particles[j].x;
						const dy = particles[i].y - particles[j].y;
						const d = Math.sqrt(dx * dx + dy * dy);
						if (d < 150) {
							ctx.strokeStyle = `rgba(233, 130, 60, ${0.06 * (1 - d / 150)})`;
							ctx.lineWidth = 0.5;
							ctx.beginPath();
							ctx.moveTo(particles[i].x, particles[i].y);
							ctx.lineTo(particles[j].x, particles[j].y);
							ctx.stroke();
						}
					}
				}
				animId = requestAnimationFrame(draw);
			};
			draw();
		}

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', resize);
		};
	}

	let cleanup: (() => void) | undefined;

	$effect(() => {
		cleanup?.();
		cleanup = undefined;
		if (isDynamic && canvas) {
			cleanup = startAnimation(wallpaper);
		}
	});

	onDestroy(() => {
		cleanup?.();
		if (browser) cancelAnimationFrame(animId);
	});
</script>

<div class="wallpaper" class:is-solid={isSolid}>
	{#if isGradient}
		<div class="wallpaper-gradient wallpaper-gradient--{wallpaper}"></div>
	{:else if isDynamic}
		<canvas bind:this={canvas} class="wallpaper-canvas"></canvas>
	{/if}
</div>

<style>
	.wallpaper {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		background: var(--wallpaper-base);
	}

	.wallpaper.is-solid {
		background: var(--wallpaper-base);
	}

	/* ─── Gradient meshes ─── */
	.wallpaper-gradient {
		position: absolute;
		inset: 0;
		filter: blur(40px) saturate(1.5);
	}

	.wallpaper-gradient--mesh-aubergine {
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(233, 84, 32, 0.52) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(245, 140, 55, 0.32) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(200, 60, 115, 0.24) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(210, 110, 170, 0.32) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(250, 160, 60, 0.26) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(150, 60, 140, 0.22) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(255, 130, 60, 0.50) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(255, 185, 110, 0.42) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(78, 22, 54, 0.45) 0%, transparent 70%),
			var(--wallpaper-gradient);
	}

	.wallpaper-gradient--mesh-ocean {
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(32, 120, 233, 0.45) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(55, 160, 245, 0.30) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(60, 140, 200, 0.22) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(110, 170, 220, 0.30) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(40, 180, 200, 0.24) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(60, 100, 180, 0.20) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(80, 200, 240, 0.40) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(140, 220, 255, 0.35) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(20, 40, 80, 0.45) 0%, transparent 70%),
			var(--wallpaper-gradient);
	}

	.wallpaper-gradient--mesh-forest {
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(32, 160, 80, 0.40) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(80, 180, 55, 0.28) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(40, 120, 80, 0.22) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(100, 180, 120, 0.28) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(60, 160, 100, 0.22) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(30, 100, 60, 0.20) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(80, 200, 100, 0.38) 0%, transparent 60%),
			radial-gradient(ellipse 40% 35% at 95% 5%, rgba(150, 220, 120, 0.30) 0%, transparent 65%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(20, 50, 30, 0.45) 0%, transparent 70%),
			var(--wallpaper-gradient);
	}

	/* ─── Dynamic canvas ─── */
	.wallpaper-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
</style>
