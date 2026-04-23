import { getTutorialBySlug, getAllTutorials } from '$lib/data/tutorial-loader';
import { error } from '@sveltejs/kit';

export function entries() {
	return getAllTutorials().map((t) => ({ slug: t.meta.slug }));
}

export function load({ params }: { params: { slug: string } }) {
	const tutorial = getTutorialBySlug(params.slug);
	if (!tutorial) error(404, 'Tutorial not found');
	return { tutorial };
}
