import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RequestHandler } from './$types';

export const prerender = false;

function compositionPath(slug: string): string {
	return resolve('src/tutorials', slug, 'composition.json');
}

export const GET: RequestHandler = ({ params }) => {
	const path = compositionPath(params.slug);
	if (!existsSync(path)) {
		return json({ exists: false });
	}
	const raw = readFileSync(path, 'utf-8');
	return json({ exists: true, composition: JSON.parse(raw) });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const composition = await request.json();
	const dir = resolve('src/tutorials', params.slug);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	const path = compositionPath(params.slug);
	writeFileSync(path, JSON.stringify(composition, null, 2), 'utf-8');
	return json({ ok: true });
};
