import { json, error } from '@sveltejs/kit';
import { existsSync, mkdirSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import type { RequestHandler } from './$types';

export const prerender = false;

const trashRoot = resolve('.trash');

function moveToTrash(src: string, trashSubdir: string, name: string) {
	const dest = join(trashRoot, trashSubdir);
	if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
	const target = join(dest, name);
	if (existsSync(target)) rmSync(target, { recursive: true });
	renameSync(src, target);
}

interface DeleteRequest {
	kind: 'session' | 'trace' | 'tutorial' | 'asset';
	slug?: string;
	filename?: string;
	shared?: boolean;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as DeleteRequest;

	switch (body.kind) {
		case 'session': {
			if (!body.slug) error(400, 'slug required');
			const dir = resolve('src/sessions', body.slug);
			if (!existsSync(dir)) error(404, 'Session not found');
			moveToTrash(dir, 'sessions', body.slug);
			return json({ ok: true });
		}
		case 'trace': {
			if (!body.slug) error(400, 'slug required');
			const dir = resolve('src/traces', body.slug);
			if (!existsSync(dir)) error(404, 'Trace not found');
			moveToTrash(dir, 'traces', body.slug);
			return json({ ok: true });
		}
		case 'tutorial': {
			if (!body.slug) error(400, 'slug required');
			const tutorialDir = resolve('src/tutorials', body.slug);
			const assetsDir = resolve('static/tutorials', body.slug);
			const hasTutorial = existsSync(tutorialDir);
			const hasAssets = existsSync(assetsDir);
			if (!hasTutorial && !hasAssets) error(404, 'Tutorial not found');
			if (hasTutorial) moveToTrash(tutorialDir, 'tutorials', body.slug);
			if (hasAssets) moveToTrash(assetsDir, 'tutorial-assets', body.slug);
			return json({ ok: true });
		}
		case 'asset': {
			if (!body.filename) error(400, 'filename required');
			const filepath = body.shared
				? resolve('static/assets', body.filename)
				: body.slug
					? resolve('static/tutorials', body.slug, 'assets', body.filename)
					: null;
			if (!filepath) error(400, 'slug required for tutorial assets');
			if (!existsSync(filepath)) error(404, 'Asset not found');
			moveToTrash(filepath, 'assets', body.filename);
			return json({ ok: true });
		}
		default:
			error(400, 'Invalid kind');
	}
};
