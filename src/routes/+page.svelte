<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import TutorialCard from '$lib/components/TutorialCard.svelte';
	import MatrixRain from '$lib/components/MatrixRain.svelte';
	import Wallpaper from '$lib/components/Wallpaper.svelte';
	import { t } from '$lib/stores/lang.svelte';
	import { getAllTutorials } from '$lib/data/tutorial-loader';

	const tutorials = getAllTutorials();

	const rotatingWords = [
		{ en: 'Research', ja: 'リサーチ' },
		{ en: 'Coding', ja: 'コーディング' },
		{ en: 'Analysis', ja: '解析' },
		{ en: 'Review', ja: 'レビュー' },
		{ en: 'Building', ja: '構築' }
	];

	let wordIndex = $state(0);
	let displayText = $state(t(rotatingWords[0]));

	function scrambleTo(target: string) {
		const from = displayText;
		const maxLen = Math.max(from.length, target.length);
		const totalFrames = 6;
		let frame = 0;

		const tick = setInterval(() => {
			frame++;
			const progress = frame / totalFrames;
			let result = '';
			for (let i = 0; i < maxLen; i++) {
				const charDone = progress > (i + 1) / maxLen;
				if (charDone) {
					result += target[i] ?? '';
				} else if (i < target.length) {
					result += Math.random() < 0.5 ? '0' : '1';
				}
			}
			displayText = result;
			if (frame >= totalFrames) {
				clearInterval(tick);
				displayText = target;
			}
		}, 50);
	}

	$effect(() => {
		const interval = setInterval(() => {
			const nextIndex = (wordIndex + 1) % rotatingWords.length;
			wordIndex = nextIndex;
			scrambleTo(t(rotatingWords[nextIndex]));
		}, 5000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{t({ en: 'AI Research Tutorials', ja: 'AI リサーチチュートリアル' })}</title>
	<meta
		name="description"
		content={t({
			en: 'Learn how to use AI agents for research tasks: coding, image analysis, modelling, and more.',
			ja: 'AI エージェントを使った研究タスクの実践的チュートリアル'
		})}
	/>
</svelte:head>

<Nav />

<!-- Hero Section -->
<section class="hero">
	<div class="hero__bg" aria-hidden="true"><Wallpaper /></div>
	<MatrixRain />
	<div class="hero__inner">
		<div class="hero__label">
			<span>{t({ en: 'Kyoto University \u00b7 ASHBi', ja: '京都大学 \u00b7 ASHBi' })}</span>
		</div>
		<h1 class="hero__title">
			AI <span class="hero__rotating">{displayText}</span><br />
			{t({ en: 'Tutorials', ja: 'チュートリアル' })}
		</h1>
		<p class="hero__subtitle">
			{t({
				en: 'Learn how to use AI agents for research tasks \u2014 coding, image analysis, mathematical modelling, literature research, data analysis and more.',
				ja: 'AI エージェントを活用した研究タスクの実践的チュートリアル'
			})}
		</p>
		<a href="#tutorials" class="hero__cta">
			{t({ en: 'Browse Tutorials', ja: 'チュートリアルを見る' })}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M5 12h14m-7-7 7 7-7 7" />
			</svg>
		</a>
	</div>

	<!-- Wave divider -->
	<div class="hero__wave" aria-hidden="true">
		<svg viewBox="0 0 1440 48" preserveAspectRatio="none">
			<path d="M0 24C240 0 480 48 720 24C960 0 1200 48 1440 24V48H0Z" fill="var(--bg-primary)" />
		</svg>
	</div>
</section>

<!-- Tutorials Section -->
<section class="tutorials" id="tutorials">
	<div class="tutorials__inner">
		<div class="tutorials__header">
			<h2 class="tutorials__heading">
				{t({ en: 'All Tutorials', ja: 'すべてのチュートリアル' })}
			</h2>
			<span class="tutorials__count">{tutorials.length} {tutorials.length === 1 ? 'post' : 'posts'}</span>
		</div>

		{#each tutorials as tutorial, i}
			<div style="animation-delay: {0.1 + i * 0.08}s">
				<TutorialCard {tutorial} />
			</div>
		{/each}
	</div>
</section>

<Footer />

<style>
	.hero {
		position: relative;
		padding: 120px 24px 64px;
		overflow: hidden;
	}

	.hero__bg {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.hero__inner {
		max-width: 960px;
		margin: 0 auto;
		position: relative;
		z-index: 1;
	}

	.hero__label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--accent);
		margin-bottom: 20px;
		opacity: 0;
		animation: fadeUp 0.6s ease forwards;
	}

	.hero__label::before {
		content: '';
		display: inline-block;
		width: 20px;
		height: 2px;
		background: var(--accent);
		border-radius: 1px;
	}

	.hero__title {
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		font-weight: 700;
		letter-spacing: -0.035em;
		line-height: 1.1;
		color: var(--text-primary);
		margin-bottom: 16px;
		opacity: 0;
		animation: fadeUp 0.6s ease 0.1s forwards;
	}

	.hero__rotating {
		display: inline-block;
		color: var(--accent);
		font-family: var(--font-mono);
	}

	.hero__subtitle {
		font-size: 1.1rem;
		font-weight: 400;
		color: var(--text-secondary);
		max-width: 520px;
		line-height: 1.65;
		margin-bottom: 32px;
		opacity: 0;
		animation: fadeUp 0.6s ease 0.2s forwards;
	}

	.hero__cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 600;
		color: white;
		background: var(--accent);
		border: none;
		padding: 13px 28px;
		border-radius: 10px;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.25s ease;
		box-shadow: 0 2px 8px var(--accent-glow);
		opacity: 0;
		animation: fadeUp 0.6s ease 0.3s forwards;
	}

	.hero__cta:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px var(--accent-glow);
		text-decoration: none;
	}

	.hero__cta svg {
		width: 16px;
		height: 16px;
		transition: transform 0.2s ease;
	}

	.hero__cta:hover svg {
		transform: translateX(3px);
	}

	.hero__wave {
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 48px;
		overflow: hidden;
		z-index: 2;
	}

	.hero__wave svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.tutorials {
		position: relative;
		z-index: 1;
		padding: 48px 24px 80px;
	}

	.tutorials__inner {
		max-width: 960px;
		margin: 0 auto;
	}

	.tutorials__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 24px;
	}

	.tutorials__heading {
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-tertiary);
	}

	.tutorials__count {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	@media (max-width: 640px) {
		.hero {
			padding: 100px 16px 56px;
		}

		.hero__subtitle {
			font-size: 1rem;
		}

		.tutorials {
			padding: 32px 16px 64px;
		}
	}
</style>
