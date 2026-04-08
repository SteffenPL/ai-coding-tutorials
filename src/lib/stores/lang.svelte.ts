import { browser } from '$app/environment';

export type Lang = 'en' | 'ja';

function getInitialLang(): Lang {
	if (browser) {
		const saved = localStorage.getItem('ashbi-lang') as Lang | null;
		if (saved) return saved;
	}
	return 'en';
}

function createLangStore() {
	const initial = getInitialLang();
	let lang = $state<Lang>(initial);

	if (browser) {
		document.documentElement.setAttribute('data-lang', initial);
	}

	return {
		get current() {
			return lang;
		},
		set(newLang: Lang) {
			lang = newLang;
			if (browser) {
				document.documentElement.setAttribute('data-lang', lang);
				localStorage.setItem('ashbi-lang', lang);
			}
		}
	};
}

export const langStore = createLangStore();

/**
 * Get a localized string with English fallback.
 * Pass an object with `en` (required) and optional `ja`.
 */
export function t(strings: { en: string; ja?: string }): string {
	if (langStore.current === 'ja' && strings.ja) {
		return strings.ja;
	}
	return strings.en;
}
