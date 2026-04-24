import { getSessionBySlug } from '$lib/session/loader';
import { toSessionView, type SessionView } from '$lib/session/viewmodel';

export const prerender = false;

export function load({ params, url }: { params: { slug: string }; url: URL }) {
	const sessionSlug = url.searchParams.get('session') ?? params.slug;
	const session = getSessionBySlug(sessionSlug);
	return {
		view: session ? toSessionView(session) : null as SessionView | null,
		slug: params.slug,
		sessionSlug
	};
}
