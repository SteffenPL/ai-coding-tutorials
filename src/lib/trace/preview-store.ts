import type { Tutorial } from '$lib/data/tutorials';

const previews = new Map<string, Tutorial>();

export function setPreview(slug: string, tutorial: Tutorial) {
	previews.set(slug, tutorial);
}

export function getPreview(slug: string): Tutorial | undefined {
	return previews.get(slug);
}
