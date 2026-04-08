import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
	if (browser) {
		const saved = localStorage.getItem('ashbi-theme') as Theme | null;
		if (saved) return saved;
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
	}
	return 'light';
}

function createThemeStore() {
	const initial = getInitialTheme();
	let theme = $state<Theme>(initial);

	if (browser) {
		document.documentElement.setAttribute('data-theme', initial);
	}

	return {
		get current() {
			return theme;
		},
		toggle() {
			theme = theme === 'dark' ? 'light' : 'dark';
			if (browser) {
				document.documentElement.setAttribute('data-theme', theme);
				localStorage.setItem('ashbi-theme', theme);
			}
		}
	};
}

export const themeStore = createThemeStore();
