import { getAllSessionSlugs } from '$lib/session/loader';

export function load() {
	return { slugs: getAllSessionSlugs() };
}
