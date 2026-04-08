import { error } from '@sveltejs/kit';
import { getTutorialBySlug } from '$lib/data/markdown';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const tutorial = getTutorialBySlug(params.slug);
	if (!tutorial) {
		error(404, 'Tutorial not found');
	}
	return { tutorial };
};
