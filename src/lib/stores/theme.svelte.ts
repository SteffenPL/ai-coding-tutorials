import { browser } from '$app/environment';

export type ColorTheme = 'warm' | 'dark' | 'light';
export type WallpaperName = 'mesh-aubergine' | 'mesh-ocean' | 'mesh-forest' | 'mesh-sunset'
	| 'solid-theme' | 'solid-charcoal';

export const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string }[] = [
	{ id: 'warm', label: 'Warm', swatch: '#2C001E' },
	{ id: 'dark', label: 'Dark', swatch: '#1a1a20' },
	{ id: 'light', label: 'Light', swatch: '#f0e8e4' }
];

export const WALLPAPERS: { id: WallpaperName; label: string; category: 'gradient' | 'solid' }[] = [
	{ id: 'mesh-aubergine', label: 'Aubergine', category: 'gradient' },
	{ id: 'mesh-ocean', label: 'Ocean', category: 'gradient' },
	{ id: 'mesh-forest', label: 'Forest', category: 'gradient' },
	{ id: 'mesh-sunset', label: 'Sunset', category: 'gradient' },
	{ id: 'solid-theme', label: 'Solid', category: 'solid' },
	{ id: 'solid-charcoal', label: 'Charcoal', category: 'solid' }
];

const STORAGE_KEY = 'ai-tutorials-theme';

interface ThemePrefs {
	colorTheme: ColorTheme;
	wallpaper: WallpaperName;
}

const DEFAULTS: ThemePrefs = {
	colorTheme: 'warm',
	wallpaper: 'mesh-aubergine'
};

function load(): ThemePrefs {
	if (!browser) return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw) as Partial<ThemePrefs>;
		return {
			colorTheme: COLOR_THEMES.some(t => t.id === parsed.colorTheme) ? parsed.colorTheme! : DEFAULTS.colorTheme,
			wallpaper: WALLPAPERS.some(w => w.id === parsed.wallpaper) ? parsed.wallpaper! : DEFAULTS.wallpaper
		};
	} catch {
		return DEFAULTS;
	}
}

function persist(prefs: ThemePrefs) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch { /* ignore */ }
}

function applyToDOM(prefs: ThemePrefs) {
	if (!browser) return;
	document.documentElement.setAttribute('data-theme', prefs.colorTheme);
	document.documentElement.setAttribute('data-wallpaper', prefs.wallpaper);
}

function createThemeStore() {
	const initial = load();
	let colorTheme = $state<ColorTheme>(initial.colorTheme);
	let wallpaper = $state<WallpaperName>(initial.wallpaper);

	applyToDOM(initial);

	$effect.root(() => {
		$effect(() => {
			const prefs = { colorTheme, wallpaper };
			applyToDOM(prefs);
			persist(prefs);
		});
	});

	return {
		get colorTheme() { return colorTheme; },
		set colorTheme(v: ColorTheme) { colorTheme = v; },
		get wallpaper() { return wallpaper; },
		set wallpaper(v: WallpaperName) { wallpaper = v; }
	};
}

export const themeStore = createThemeStore();
