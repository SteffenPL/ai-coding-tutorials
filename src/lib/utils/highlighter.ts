/**
 * Shared Shiki highlighter — lazy, singleton, fine-grained bundle.
 *
 * Why this file exists:
 * - Creating a highlighter is expensive (loads grammars + theme). We want
 *   exactly one instance for the whole app, reused across every SourceView.
 * - Each `import('shiki/langs/*.mjs')` is a dynamic import, so Vite emits
 *   each language as its own async chunk — loaded only when the first
 *   highlight call resolves, not at page boot.
 *
 * We use Shiki's **JavaScript regex engine** (not the default Oniguruma
 * WASM engine) so there's no .wasm asset to host on GitHub Pages. The JS
 * engine is a little slower, but grammars for small snippets highlight
 * in sub-millisecond time on modern hardware.
 */

import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

/** Languages we ship grammars for. Unknown languages fall back to plaintext. */
export const SUPPORTED_LANGS = [
	'python',
	'javascript',
	'typescript',
	'bash',
	'json',
	'groovy',
	'markdown'
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** Aliases → canonical. Anything not in here or SUPPORTED_LANGS renders plain. */
const LANG_ALIASES: Record<string, SupportedLang> = {
	py: 'python',
	js: 'javascript',
	ts: 'typescript',
	sh: 'bash',
	shell: 'bash',
	zsh: 'bash',
	md: 'markdown',
	// ImageJ Macro language has no grammar in Shiki — falls back to groovy,
	// which handles C-style syntax reasonably. The user can override via a
	// proper grammar later if needed.
	ijm: 'groovy'
};

export const THEME = 'vitesse-dark';

let highlighterPromise: Promise<HighlighterCore> | null = null;

export function getHighlighter(): Promise<HighlighterCore> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighterCore({
			themes: [import('shiki/themes/vitesse-dark.mjs')],
			langs: [
				import('shiki/langs/python.mjs'),
				import('shiki/langs/javascript.mjs'),
				import('shiki/langs/typescript.mjs'),
				import('shiki/langs/bash.mjs'),
				import('shiki/langs/json.mjs'),
				import('shiki/langs/groovy.mjs'),
				import('shiki/langs/markdown.mjs')
			],
			engine: createJavaScriptRegexEngine()
		});
	}
	return highlighterPromise;
}

/** Normalize a user-provided language hint to something Shiki knows, or null. */
export function resolveLang(hint: string | undefined): SupportedLang | null {
	if (!hint) return null;
	const lower = hint.toLowerCase();
	if ((SUPPORTED_LANGS as readonly string[]).includes(lower)) {
		return lower as SupportedLang;
	}
	return LANG_ALIASES[lower] ?? null;
}
