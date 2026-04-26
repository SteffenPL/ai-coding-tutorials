import { error } from '@sveltejs/kit';
import { getTutorialBySlug } from '$lib/data/tutorial-loader';

export const prerender = false;

export function load({ params }: { params: { slug: string } }) {
	const tutorial = getTutorialBySlug(params.slug);
	if (!tutorial) error(404, `Tutorial "${params.slug}" not found`);
	return { tutorial };
}
