import { error } from '@sveltejs/kit';
import { getTutorialBySlug } from '$lib/data/tutorial-loader';

export const prerender = false;

export function load({ params, url }: { params: { slug: string }; url: URL }) {
	const tutorial = getTutorialBySlug(params.slug);
	if (!tutorial) error(404, `Tutorial "${params.slug}" not found`);
	return { tutorial, theme: url.searchParams.get('theme') };
}
