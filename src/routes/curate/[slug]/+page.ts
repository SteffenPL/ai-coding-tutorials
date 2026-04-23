import { getSessionBySlug } from '$lib/session/loader';
import { toSessionView, type SessionView } from '$lib/session/viewmodel';

export const prerender = false;

export function load({ params }: { params: { slug: string } }) {
	const session = getSessionBySlug(params.slug);
	return {
		view: session ? toSessionView(session) : null as SessionView | null,
		slug: params.slug
	};
}
