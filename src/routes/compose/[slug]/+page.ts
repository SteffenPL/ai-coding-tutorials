export const prerender = false;

export async function load({ params, fetch }) {
	const [compRes, dashRes] = await Promise.all([
		fetch(`/api/compose/${params.slug}`),
		fetch('/api/edit/dashboard')
	]);
	const compData = await compRes.json();
	const dashData = await dashRes.json();

	return {
		slug: params.slug,
		composition: compData.exists ? compData.composition : null,
		availableTraces: dashData.traces ?? []
	};
}
