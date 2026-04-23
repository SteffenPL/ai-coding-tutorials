import { error } from '@sveltejs/kit';
import { getAllSessionSlugs, getSessionBySlug } from '$lib/session/loader';
import { toSessionView } from '$lib/session/viewmodel';

export function entries() {
	return getAllSessionSlugs().map((slug) => ({ slug }));
}

export function load({ params }: { params: { slug: string } }) {
	const session = getSessionBySlug(params.slug);
	if (!session) error(404, `No session found for slug '${params.slug}'`);
	return { view: toSessionView(session) };
}
