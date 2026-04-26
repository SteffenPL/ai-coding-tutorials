/**
 * Tutorial data system.
 *
 * Each tutorial is a structured object with metadata and an ordered array of
 * steps. This format is designed to be:
 *   - hand-authored for curated demos
 *   - auto-generated from Claude Code JSONL traces (future importer)
 *   - consumed by the TraceViewer component to render the interactive timeline
 */

import type { Lang } from '$lib/stores/lang.svelte';

/* ─── Types ─────────────────────────────────── */

export interface SessionRef {
	id: string;
	source?: string;
	raw?: string;
	imported?: boolean;
}

export type TutorialVisibility = 'public' | 'draft' | 'hidden';

export interface TutorialMeta {
	slug: string;
	title: { en: string; ja?: string };
	tags: string[];
	thumbnail?: string;
	sessions?: SessionRef[];
	author?: string;
	/** Controls listing visibility: 'public' (default), 'draft' (dev only), 'hidden' (never listed, accessible by slug) */
	visibility?: TutorialVisibility;
}

/**
 * A single step in the trace timeline.
 *
 * Terminal-side steps (rendered in the scrollable chat area):
 * - "assistant": Claude's text response
 * - "thinking": Claude's reasoning (collapsible)
 * - "tool_call": A tool invocation with code
 * - "tool_result": Output/confirmation from a tool
 * - "permission": Permission request with pre-selected response
 * - "question": Claude asks a question, user answer pre-selected
 * - "output": Raw terminal output (for terminal rounds)
 * - "status": Compact runtime/info badge
 * - "table": A results table (e.g. measurements)
 * - "divider": A visual step divider with label
 *
 * Desktop-side steps (rendered in the window stack):
 * - "window": A desktop window showing content (image, code, etc.)
 */
export type StepType =
	| 'assistant' | 'thinking' | 'question'
	| 'tool_call' | 'tool_result' | 'permission' | 'output'
	| 'window' | 'table' | 'status' | 'divider';

export interface StepBase {
	type: StepType;
	/**
	 * Tutorial comment (HTML) shown in the comment panel for this step.
	 * Either a plain string (English only) or a localized `{ en, ja? }` object.
	 * Terminal/session content stays in its original language; comments explain
	 * that content and can be translated.
	 */
	comment?: string | { en: string; ja?: string };
	/** Render as a compact chip instead of full content */
	compact?: boolean;
	/** Collapse into a "N steps hidden" placeholder in simplified view */
	hidden?: boolean;
	/** Promo view: milliseconds before auto-advancing to the next step */
	promoDuration?: number;
}

/* ─── Chat Steps ──────────────────────────── */

export interface AssistantStep extends StepBase {
	type: 'assistant';
	/** HTML content of the assistant's message */
	html: string;
	/** Mark as the final answer to a round's prompt (visually highlighted) */
	final?: boolean;
}

/**
 * Claude's internal reasoning. Rendered as a collapsible block.
 * Generator source: thinking blocks in JSONL trace.
 */
export interface ThinkingStep extends StepBase {
	type: 'thinking';
	/** The thinking/reasoning text */
	text: string;
	/** Optional duration label (e.g. "12s") */
	duration?: string;
}

/**
 * Claude asks a question; the user's answer is shown inline.
 * Not interactive — just displays the Q&A flow.
 * Generator source: assistant message ending with question + next human turn.
 */
export interface QuestionStep extends StepBase {
	type: 'question';
	/** The question Claude asks (HTML) */
	html: string;
	/** The pre-selected user answer */
	answer: string;
}

/* ─── Execution Steps ─────────────────────── */

export interface ToolCallStep extends StepBase {
	type: 'tool_call';
	/** Tool name displayed in the header */
	toolName: string;
	/** Code content of the tool call */
	code: string;
}

export interface ToolResultStep extends StepBase {
	type: 'tool_result';
	/** Result text */
	text: string;
}

/**
 * Permission request dialog with pre-selected response.
 * Generator source: tool_use with permission gating in trace.
 */
export interface PermissionStep extends StepBase {
	type: 'permission';
	/** Tool name requesting permission (e.g. "Bash", "Edit") */
	tool: string;
	/** What the tool wants to do */
	description: string;
	/** Whether permission was granted */
	granted: boolean;
}

/**
 * Raw terminal output — used in terminal rounds for command results.
 * Generator source: Bash stdout/stderr from terminal sessions.
 */
export interface OutputStep extends StepBase {
	type: 'output';
	/** Terminal output text (rendered as preformatted) */
	text: string;
	/** Output stream for visual styling */
	stream?: 'stdout' | 'stderr';
}

/* ─── Display Steps ───────────────────────── */

/**
 * Compact status/runtime badge.
 * Generator source: synthetic timing events or completion summaries.
 */
export interface StatusStep extends StepBase {
	type: 'status';
	/** Status message text */
	text: string;
	/** Visual variant */
	variant?: 'success' | 'info' | 'warning' | 'error';
}

/* ─── Window Content Types ────────────────── */

/**
 * Fiji image with optional status bar — the classic ImageJ window.
 * Generator source: Fiji MCP get_thumbnail / save_image results.
 */
export interface FijiImageContent {
	kind: 'fiji-image';
	/** Path to image file (relative to static/) */
	src: string;
	/** Fiji status bar text (e.g. "512×512 pixels; 8-bit; 256K") */
	statusBar?: string;
}

/**
 * Plain image window without Fiji chrome.
 * Generator source: any image file reference in the trace.
 */
export interface ImageContent {
	kind: 'image';
	/** Path to image file (relative to static/) */
	src: string;
}

/**
 * Rendered markdown document.
 * Generator source: Read tool on .md files, or inline markdown content.
 */
export interface MarkdownContent {
	kind: 'markdown';
	/** Raw markdown text (rendered at display time) */
	text: string;
}

/**
 * Source code with optional syntax highlighting.
 * Generator source: Read/Write tool on code files.
 */
export interface SourceContent {
	kind: 'source';
	/** Raw source code text */
	text: string;
	/** Language hint for highlighting (e.g. 'python', 'javascript', 'ijm') */
	language?: string;
}

/**
 * Folder tree view showing project structure.
 * Generator source: Bash ls/tree output or Glob results.
 */
export interface FolderContent {
	kind: 'folder';
	/** Recursive tree of entries */
	entries: FolderEntry[];
}

export interface FolderEntry {
	name: string;
	type: 'file' | 'folder';
	/** Children (only for folders) */
	children?: FolderEntry[];
}

/**
 * Looping video window.
 * Generator source: video file references or screen recordings.
 */
export interface VideoContent {
	kind: 'video';
	/** Path to video file (relative to static/) */
	src: string;
	/** Optional poster frame image */
	poster?: string;
}

/**
 * A collection of sub-windows arranged in a rows×cols grid.
 * Rendered directly in the desktop stack without an outer chrome —
 * each sub-window gets its own WindowChrome.
 */
export interface WindowCollectionContent {
	kind: 'window-collection';
	rows: number;
	cols: number;
	windows: WindowCollectionEntry[];
}

export interface WindowCollectionEntry {
	title: string;
	subtitle?: string;
	content: WindowContentData;
}

export type WindowContentData =
	| FijiImageContent
	| ImageContent
	| MarkdownContent
	| SourceContent
	| FolderContent
	| VideoContent
	| WindowCollectionContent;

/** Default icon text for each window content kind */
export function getWindowIcon(content: WindowContentData): string {
	switch (content.kind) {
		case 'fiji-image': return 'Fj';
		case 'image': return 'Im';
		case 'markdown': return 'Md';
		case 'source': return '</>';
		case 'folder': return '📁';
		case 'video': return '▶';
		case 'window-collection': return '⊞';
	}
}

/** Whether a window content kind renders its own chrome (no outer chrome needed). */
export function isChromeless(content: WindowContentData): boolean {
	return content.kind === 'window-collection';
}

/**
 * A desktop window step. Renders as a stacked window in the right column
 * (desktop) or inline with window chrome (mobile).
 */
export interface WindowStep extends StepBase {
	type: 'window';
	/** Window title bar text */
	windowTitle: string;
	/** Subtitle shown next to title (e.g. dimensions, language) */
	subtitle?: string;
	/** Override the default icon derived from content kind */
	icon?: string;
	/** The window's inner content */
	content: WindowContentData;
}

export interface TableStep extends StepBase {
	type: 'table';
	/** Column headers */
	columns: string[];
	/** Row data — each row is an array of strings */
	rows: string[][];
	/** Optional: number of additional rows not shown */
	moreRows?: number;
}

export interface DividerStep extends StepBase {
	type: 'divider';
	/** Divider label text */
	label: string;
}

export type Step =
	| AssistantStep | ThinkingStep | QuestionStep
	| ToolCallStep | ToolResultStep | PermissionStep | OutputStep
	| WindowStep | TableStep | StatusStep | DividerStep;

export interface TutorialRound {
	/** Round kind — 'claude' for AI sessions (default), 'terminal' for shell sessions */
	kind?: 'claude' | 'terminal';
	/** The user's prompt (claude round) or shell command(s) (terminal round) */
	prompt: string;
	/** Working directory shown above the command in terminal rounds (e.g. "~/workspace/demo") */
	cwd?: string;
	/** Ordered list of steps in the trace for this round */
	steps: Step[];
}

export interface Tutorial {
	meta: TutorialMeta;
	description?: string;
	requirements?: string;
	rounds: TutorialRound[];
}

/* ─── Helpers ───────────────────────────────── */

export function getTutorialTitle(meta: TutorialMeta, lang: Lang): string {
	if (lang === 'ja' && meta.title.ja) return meta.title.ja;
	return meta.title.en;
}

/* ─── Registry ──────────────────────────────── */

/**
 * Tutorials are loaded from `src/tutorials/<slug>/` YAML folders.
 * See `$lib/data/tutorial-loader` for the runtime registry.
 */
