import { Marked } from 'marked';
import yaml from 'js-yaml';
import type { Token, Tokens, TokenizerExtension, RendererExtension } from 'marked';

// ─── Custom :::prompt extension ───

interface PromptToken extends Tokens.Generic {
	type: 'prompt';
	raw: string;
	text: string;
}

const promptExtension: TokenizerExtension & RendererExtension = {
	name: 'prompt',
	level: 'block',
	start(src: string) {
		return src.indexOf(':::prompt');
	},
	tokenizer(src: string): PromptToken | undefined {
		const match = src.match(/^:::prompt\n([\s\S]*?)^:::/m);
		if (match) {
			return {
				type: 'prompt',
				raw: match[0],
				text: match[1].trim()
			};
		}
	},
	renderer(token: Token): string | false {
		if (token.type !== 'prompt') return false;
		const t = token as PromptToken;
		const escaped = t.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return `<div class="prompt-box" data-prompt>
<div class="prompt-box__header">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
<span data-t-prompt-label></span>
<button class="prompt-box__copy" data-copy-prompt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span data-t-copy-label></span></button>
</div>
<div class="prompt-box__content">${escaped}</div>
</div>\n`;
	}
};

// ─── Custom code block renderer (with copy button) ───

const codeRenderer = {
	code({ text, lang }: Tokens.Code): string {
		const language = lang || 'text';
		const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return `<div class="code-block" data-code>
<div class="code-block__header">
<span class="code-block__lang">${language}</span>
<button class="code-block__copy" data-copy-code><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span data-t-copy-label></span></button>
</div>
<pre><code>${escaped}</code></pre>
</div>\n`;
	}
};

// ─── Create configured marked instance ───

const marked = new Marked();
marked.use({
	extensions: [promptExtension],
	renderer: codeRenderer
});

// ─── Frontmatter types ───

export interface TutorialMeta {
	slug: string;
	title: string;
	tags: string[];
	updated: string;
	duration?: number;
	hasVideo: boolean;
	videoUrl?: string;
	githubUrl?: string;
	links?: { label: string; url: string }[];
}

interface RawFrontmatter {
	title?: string;
	tags?: string[];
	updated?: string;
	duration?: number;
	hasVideo?: boolean;
	videoUrl?: string;
	githubUrl?: string;
	links?: { label: string; url: string }[];
}

// ─── Load all markdown files at build time ───

const allFiles = import.meta.glob('/src/content/tutorials/*.md', {
	query: '?raw',
	eager: true
}) as Record<string, { default: string }>;

interface ParsedTutorial {
	meta: RawFrontmatter;
	html: string;
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) return { data: {}, content: raw };
	const data = (yaml.load(match[1]) as Record<string, unknown>) || {};
	return { data, content: match[2] };
}

function parseMarkdown(raw: string): ParsedTutorial {
	const { data, content } = parseFrontmatter(raw);
	const html = marked.parse(content) as string;
	return { meta: data as RawFrontmatter, html };
}

// Group files by slug and lang
function buildTutorialIndex() {
	const slugMap = new Map<string, { en?: ParsedTutorial; ja?: ParsedTutorial }>();

	for (const [path, mod] of Object.entries(allFiles)) {
		// path: /src/content/tutorials/python-bioinformatics.en.md
		const filename = path.split('/').pop()!;
		const match = filename.match(/^(.+)\.(en|ja)\.md$/);
		if (!match) continue;

		const [, slug, lang] = match;
		if (!slugMap.has(slug)) slugMap.set(slug, {});
		slugMap.get(slug)![lang as 'en' | 'ja'] = parseMarkdown(mod.default);
	}

	return slugMap;
}

const tutorialIndex = buildTutorialIndex();

// ─── Public API ───

export interface Tutorial {
	slug: string;
	meta: TutorialMeta;
	/** Get rendered HTML for the given language (falls back to EN) */
	getHtml: (lang: 'en' | 'ja') => string;
	/** Get metadata for the given language (JA overrides merged onto EN) */
	getMeta: (lang: 'en' | 'ja') => TutorialMeta;
}

export function getAllTutorials(): Tutorial[] {
	const result: Tutorial[] = [];

	for (const [slug, data] of tutorialIndex.entries()) {
		if (!data.en) continue; // EN is required

		const enMeta = data.en.meta;
		const baseMeta: TutorialMeta = {
			slug,
			title: enMeta.title || slug,
			tags: enMeta.tags || [],
			updated: enMeta.updated || '',
			duration: enMeta.duration,
			hasVideo: enMeta.hasVideo ?? false,
			videoUrl: enMeta.videoUrl,
			githubUrl: enMeta.githubUrl,
			links: enMeta.links
		};

		result.push({
			slug,
			meta: baseMeta,
			getHtml(lang) {
				if (lang === 'ja' && data.ja) return data.ja.html;
				return data.en!.html;
			},
			getMeta(lang) {
				if (lang === 'ja' && data.ja?.meta) {
					const jaMeta = data.ja.meta;
					return {
						...baseMeta,
						title: jaMeta.title || baseMeta.title,
						links: jaMeta.links || baseMeta.links
					};
				}
				return baseMeta;
			}
		});
	}

	return result;
}

export function getTutorialBySlug(slug: string): Tutorial | undefined {
	return getAllTutorials().find((t) => t.slug === slug);
}
