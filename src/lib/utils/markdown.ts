/**
 * Shared markdown renderer — `marked` + KaTeX + Shiki.
 *
 * Why this file exists:
 * - `marked.use(...)` mutates a global instance. Calling it on every render
 *   would double-register extensions. We configure it exactly once and export
 *   an async render function.
 * - Code blocks are upgraded to Shiki HTML via a `walkTokens` hook, reusing
 *   the app-wide highlighter singleton so we don't spin up a second one.
 * - Math is handled by `marked-katex-extension`, which plugs into marked's
 *   tokenizer so `$inline$` and `$$display$$` become first-class tokens.
 */

import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import { getHighlighter, resolveLang, THEME } from './highlighter';

let configured = false;

function configure() {
	if (configured) return;
	configured = true;

	// Math — throwOnError false so a malformed formula doesn't blow up the render
	marked.use(markedKatex({ throwOnError: false }));

	// Syntax-highlight code blocks via our Shiki singleton.
	// `walkTokens` runs once per token; we mutate `code` tokens so the default
	// renderer emits our highlighted HTML instead of plain text.
	marked.use({
		async: true,
		async walkTokens(token) {
			if (token.type !== 'code') return;
			const lang = resolveLang(token.lang);
			if (!lang) return; // unknown language → default renderer handles it plainly
			try {
				const hl = await getHighlighter();
				token.text = hl.codeToHtml(token.text, { lang, theme: THEME });
				// Emit the already-rendered HTML verbatim — bypass the <pre><code>
				// wrapper the default code renderer would add (Shiki already adds one)
				(token as { type: string }).type = 'html';
			} catch {
				// Fall through to default plain rendering
			}
		}
	});

	marked.use({
		gfm: true,
		breaks: false
	});
}

/** Render markdown text to HTML. Safe to call many times — configures once. */
export async function renderMarkdown(text: string): Promise<string> {
	configure();
	return marked.parse(text, { async: true });
}
