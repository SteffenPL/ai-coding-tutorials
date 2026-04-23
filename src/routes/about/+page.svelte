<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { t } from '$lib/stores/lang.svelte';
</script>

<svelte:head>
	<title>{t({ en: 'About — AI Coding Tutorials', ja: 'About — AI コーディングチュートリアル' })}</title>
</svelte:head>

<Nav />

<main class="about">
	<div class="about__inner">
		<h1 class="about__title">{t({ en: 'About', ja: 'About' })}</h1>

		<div class="about__content">
			<p>
				{t({
					en: 'AI agents are transforming how researchers work. From writing code and analyzing images to building mathematical models, searching literature, and processing data — AI assistants can now participate as active collaborators in the research workflow.',
					ja: 'AI エージェントは研究者の働き方を変えつつあります。コードの作成、画像解析、数理モデルの構築、文献検索、データ処理まで — AI アシスタントは研究ワークフローに積極的な協力者として参加できるようになりました。'
				})}
			</p>
			<p>
				{t({
					en: 'This site collects interactive tutorials that show how AI coding agents (like Claude Code) can be used for real research tasks. Each tutorial is presented as a step-by-step trace — you see exactly what the researcher asked, what the AI did, and what the results look like.',
					ja: 'このサイトでは、AI コーディングエージェント（Claude Code など）を実際の研究タスクに活用する方法を示すインタラクティブなチュートリアルを紹介します。各チュートリアルはステップごとのトレースとして提示され、研究者が何を尋ね、AI が何を行い、どのような結果が得られたかを正確に確認できます。'
				})}
			</p>
			<p>
				{t({
					en: 'The tutorials cover a range of research applications:',
					ja: 'チュートリアルは多様な研究応用をカバーしています:'
				})}
			</p>
			<ul>
				<li>{t({ en: 'Bioimage analysis — segmentation, tracking, quantification with tools like Fiji and napari', ja: 'バイオイメージ解析 — Fiji や napari を用いたセグメンテーション、トラッキング、定量化' })}</li>
				<li>{t({ en: 'Data analysis — pandas, visualization, statistical testing', ja: 'データ解析 — pandas、可視化、統計検定' })}</li>
				<li>{t({ en: 'Mathematical modelling — ODEs, simulations, parameter fitting', ja: '数理モデリング — 常微分方程式、シミュレーション、パラメータフィッティング' })}</li>
				<li>{t({ en: 'Literature research — searching, summarizing, extracting key findings', ja: '文献調査 — 検索、要約、重要な知見の抽出' })}</li>
				<li>{t({ en: 'Scientific coding — Python, R, Julia workflows for research', ja: '科学計算 — 研究のための Python、R、Julia ワークフロー' })}</li>
			</ul>
			<p>
				{t({ en: 'Created by Steffen Plunder (', ja: '作成: Steffen Plunder (' })}<a
					href="https://steffenpl.github.io"
					target="_blank"
					rel="noopener noreferrer">{t({ en: 'webpage', ja: 'ウェブページ' })}</a
				>{t({
					en: ') · ASHBi (Institute for the Advanced Study of Human Biology), Kyoto University.',
					ja: ') · 京都大学 高等研究院 ヒト生物学高等研究拠点 (ASHBi)'
				})}
			</p>
		</div>
	</div>
</main>

<Footer />

<style>
	.about {
		padding: 100px 24px 80px;
		min-height: 80vh;
	}

	.about__inner {
		max-width: 680px;
		margin: 0 auto;
	}

	.about__title {
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.4rem);
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 32px;
		letter-spacing: -0.02em;
	}

	.about__content {
		font-size: 1rem;
		line-height: 1.75;
		color: var(--text-secondary);
	}

	.about__content p {
		margin-bottom: 16px;
	}

	.about__content ul {
		margin: 0 0 16px 24px;
		list-style: none;
	}

	.about__content li {
		position: relative;
		padding-left: 16px;
		margin-bottom: 8px;
	}

	.about__content li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 10px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		opacity: 0.6;
	}

	@media (max-width: 640px) {
		.about {
			padding: 80px 16px 64px;
		}
	}
</style>
