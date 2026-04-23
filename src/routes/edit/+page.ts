export const prerender = false;

export async function load({ fetch }) {
	const [dashRes, assetsRes, trashRes] = await Promise.all([
		fetch('/api/edit/dashboard'),
		fetch('/api/assets'),
		fetch('/api/edit/trash')
	]);
	const data = await dashRes.json();
	const assets = await assetsRes.json();
	const trash = await trashRes.json();
	return { ...data, assets, trash: trash as { items: { kind: string; name: string }[]; count: number } };
}
