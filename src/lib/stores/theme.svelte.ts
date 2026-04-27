import { browser } from '$app/environment';

export type ThemeId = 'dark-aubergine' | 'dark-matrix' | 'dark-ocean'
	| 'light-aubergine' | 'light-sky' | 'light-sunset';

export type ThemeMode = 'dark' | 'light';

export interface ThemeOption {
	id: ThemeId;
	label: string;
	mode: ThemeMode;
	swatch: string;
}

export const THEMES: ThemeOption[] = [
	{ id: 'dark-aubergine', label: 'Aubergine', mode: 'dark', swatch: '#E95420' },
	{ id: 'dark-matrix', label: 'Matrix', mode: 'dark', swatch: '#30c060' },
	{ id: 'dark-ocean', label: 'Ocean', mode: 'dark', swatch: '#3898d8' },
	{ id: 'light-aubergine', label: 'Aubergine', mode: 'light', swatch: '#c84810' },
	{ id: 'light-sky', label: 'Sky', mode: 'light', swatch: '#1868a8' },
	{ id: 'light-sunset', label: 'Sunset', mode: 'light', swatch: '#a06008' },
];

export function getMode(id: ThemeId): ThemeMode {
	return id.startsWith('light-') ? 'light' : 'dark';
}

export function themesForMode(mode: ThemeMode): ThemeOption[] {
	return THEMES.filter(t => t.mode === mode);
}

const STORAGE_KEY = 'ai-tutorials-theme';
const DEFAULT: ThemeId = 'dark-aubergine';

export function normalizeThemeId(value: string | null): ThemeId | null {
	if (!value) return null;
	const aliases: Record<string, ThemeId> = {
		aubergine: 'dark-aubergine',
		matrix: 'dark-matrix',
		blue: 'dark-ocean',
		ocean: 'dark-ocean',
		sky: 'light-sky',
		sunset: 'light-sunset'
	};
	const normalized = value.trim().toLowerCase();
	const theme = aliases[normalized] ?? normalized;
	return THEMES.some(t => t.id === theme) ? theme as ThemeId : null;
}

function load(): ThemeId {
	if (!browser) return DEFAULT;
	try {
		const requested = normalizeThemeId(new URLSearchParams(window.location.search).get('theme'));
		if (requested) return requested;
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT;
		const parsed = JSON.parse(raw);
		const id = parsed.theme ?? parsed.colorTheme ?? raw;
		const stored = normalizeThemeId(id);
		if (stored) return stored;
		return DEFAULT;
	} catch {
		return DEFAULT;
	}
}

function persist(id: ThemeId) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: id }));
	} catch { /* ignore */ }
}

function applyToDOM(id: ThemeId) {
	if (!browser) return;
	document.documentElement.setAttribute('data-theme', id);
}

function createThemeStore() {
	const initial = load();
	let theme = $state<ThemeId>(initial);

	applyToDOM(initial);

	$effect.root(() => {
		$effect(() => {
			applyToDOM(theme);
			persist(theme);
		});
	});

	return {
		get theme() { return theme; },
		set theme(v: ThemeId) { theme = v; },
		get mode(): ThemeMode { return getMode(theme); }
	};
}

export const themeStore = createThemeStore();
