/**
 * Log viewer settings — shared reactive state, persisted to localStorage.
 *
 * Two axes of control:
 *
 *   1. Detail level (0–3): a discrete slider combining collapse state AND
 *      visibility. Higher = more shown.
 *        0 overview  — prompts + final answer per round
 *        1 chat      — + all top-level assistant messages + thinking marker
 *        2 tools     — + tool/agent headers (collapsed)
 *        3 all       — + tool bodies expanded + subagent bodies rendered
 *
 *   2. Hide flags: independent filters that remove nodes entirely.
 *        hideSlashMeta — remove rounds whose prompt is a slash command or a
 *                        meta wrapper.
 *        hideThinking  — remove the extended-thinking markers.
 *
 * `hideSubagents` was folded into the detail slider — L0–L2 hide subagent
 * bodies, L3 shows them.
 */
import { browser } from '$app/environment';

export type DetailLevel = 0 | 1 | 2 | 3;

export const DETAIL_LEVELS = [
	{ level: 0, label: 'overview' },
	{ level: 1, label: 'chat' },
	{ level: 2, label: 'tools' },
	{ level: 3, label: 'all' }
] as const satisfies readonly { level: DetailLevel; label: string }[];

interface Persisted {
	detailLevel: DetailLevel;
	hideSlashMeta: boolean;
	hideThinking: boolean;
	hideToolResults: boolean;
}

// Storage key bumped when defaults change so all users land on the new
// default state. One-off loss of a custom toggle preference is acceptable.
const STORAGE_KEY = 'log-viewer-settings-v3';

const DEFAULTS: Persisted = {
	detailLevel: 2,
	hideSlashMeta: true,
	hideThinking: true,
	hideToolResults: true
};

function load(): Persisted {
	if (!browser) return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw) as Partial<Persisted>;
		const level = parsed.detailLevel;
		return {
			...DEFAULTS,
			...parsed,
			detailLevel:
				level === 0 || level === 1 || level === 2 || level === 3 ? level : DEFAULTS.detailLevel
		};
	} catch {
		return DEFAULTS;
	}
}

function persist(s: Persisted) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	} catch {
		/* ignore */
	}
}

function createSettings() {
	const initial = load();
	let detailLevel = $state<DetailLevel>(initial.detailLevel);
	let hideSlashMeta = $state<boolean>(initial.hideSlashMeta);
	let hideThinking = $state<boolean>(initial.hideThinking);
	let hideToolResults = $state<boolean>(initial.hideToolResults);

	$effect.root(() => {
		$effect(() => {
			persist({ detailLevel, hideSlashMeta, hideThinking, hideToolResults });
		});
	});

	return {
		get detailLevel() {
			return detailLevel;
		},
		set detailLevel(v: DetailLevel) {
			detailLevel = v;
		},
		get hideSlashMeta() {
			return hideSlashMeta;
		},
		set hideSlashMeta(v: boolean) {
			hideSlashMeta = v;
		},
		get hideThinking() {
			return hideThinking;
		},
		set hideThinking(v: boolean) {
			hideThinking = v;
		},
		get hideToolResults() {
			return hideToolResults;
		},
		set hideToolResults(v: boolean) {
			hideToolResults = v;
		}
	};
}

export const settings = createSettings();

/* ─── Derived visibility rules from detail level ────────────────────────── */

export interface Visibility {
	showAllAssistant: boolean; // false at L0 — only `isFinal` shown
	showUserText: boolean;
	showThinking: boolean;
	showTools: boolean;
	toolBodyOpen: boolean;
	showSubagentBody: boolean;
	showSubagentBadge: boolean;
	/** Injected user content (compaction summaries, command output, skill
	 *  payloads) is rendered in a <details> element. This controls the
	 *  default open state — closed except at the highest detail level. */
	injectedPromptOpen: boolean;
}

export function visibilityFor(level: DetailLevel): Visibility {
	return {
		showAllAssistant: level >= 1,
		showUserText: level >= 1,
		showThinking: level >= 1,
		showTools: level >= 2,
		toolBodyOpen: level >= 3,
		showSubagentBody: level >= 3,
		showSubagentBadge: level >= 2,
		injectedPromptOpen: level >= 3
	};
}
