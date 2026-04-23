import { error } from '@sveltejs/kit';

export const prerender = false;

export async function load({ params, fetch }: { params: { slug: string }; fetch: typeof globalThis.fetch }) {
	// Compose preview first (composed tutorial), then trace preview (single trace).
	for (const endpoint of [
		`/api/compose/${params.slug}/preview`,
		`/api/traces/${params.slug}/preview`
	]) {
		const res = await fetch(endpoint);
		if (!res.ok) continue;
		const json = await res.json();
		if (json.ok && json.tutorial) return { tutorial: json.tutorial };
	}
	error(404, 'No preview available — click Preview in the curate or compose page first');
}
