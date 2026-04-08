<script lang="ts">
	import { t } from '$lib/stores/lang.svelte';
</script>

<footer class="footer">
	<p class="footer__text">
		&copy; 2026 {t({ en: 'ASHBi, Kyoto University', ja: 'ASHBi 京都大学' })} &middot;
		<a href="https://ashbi.kyoto-u.ac.jp">ashbi.kyoto-u.ac.jp</a>
	</p>
</footer>

<style>
	.footer {
		position: relative;
		z-index: 1;
		border-top: 1px solid var(--border-subtle);
		padding: 32px 24px;
		text-align: center;
		transition: border-color var(--transition-theme);
	}

	.footer__text {
		font-size: 0.78rem;
		color: var(--text-tertiary);
		transition: color var(--transition-theme);
	}

	.footer__text a {
		color: var(--shark);
		text-decoration: none;
	}

	.footer__text a:hover {
		text-decoration: underline;
	}
</style>
