import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { RequestHandler } from './$types';
import { FORMAT_VERSION } from '$lib/compose/types';

export const prerender = false;

function tracePath(slug: string): string {
	return resolve('src/traces', slug, 'trace.json');
}

export const GET: RequestHandler = ({ params }) => {
	const path = tracePath(params.slug);
	if (!existsSync(path)) {
		return json({ exists: false });
	}
	const raw = readFileSync(path, 'utf-8');
	return json({ exists: true, state: JSON.parse(raw) });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const state = await request.json();
	if (!state.formatVersion) state.formatVersion = FORMAT_VERSION;
	const dir = resolve('src/traces', params.slug);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	const path = tracePath(params.slug);
	writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');
	return json({ ok: true });
};

export const DELETE: RequestHandler = ({ params }) => {
	const path = tracePath(params.slug);
	if (!existsSync(path)) {
		return json({ ok: true });
	}
	unlinkSync(path);
	const dir = dirname(path);
	try { rmdirSync(dir); } catch { /* not empty, that's fine */ }
	return json({ ok: true });
};
