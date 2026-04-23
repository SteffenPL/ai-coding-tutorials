import { json, error } from '@sveltejs/kit';
import { existsSync, readdirSync, rmSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { RequestHandler } from './$types';

export const prerender = false;

const trashRoot = resolve('.trash');

interface TrashItem {
	kind: string;
	name: string;
}

const restoreTargets: Record<string, string> = {
	sessions: 'src/sessions',
	traces: 'src/traces',
	tutorials: 'src/tutorials',
	'tutorial-assets': 'static/tutorials',
	assets: 'static/assets'
};

function listEntries(subdir: string): TrashItem[] {
	const dir = join(trashRoot, subdir);
	if (!existsSync(dir)) return [];
	return readdirSync(dir).map((name) => ({ kind: subdir, name }));
}

export const GET: RequestHandler = () => {
	const items = [
		...listEntries('sessions'),
		...listEntries('traces'),
		...listEntries('tutorials'),
		...listEntries('tutorial-assets'),
		...listEntries('assets')
	];
	return json({ items, count: items.length });
};

export const DELETE: RequestHandler = () => {
	if (existsSync(trashRoot)) {
		rmSync(trashRoot, { recursive: true });
	}
	return json({ ok: true });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { action: 'restore' | 'delete'; kind: string; name: string };

	const trashPath = join(trashRoot, body.kind, body.name);
	if (!existsSync(trashPath)) error(404, 'Item not found in trash');

	if (body.action === 'delete') {
		rmSync(trashPath, { recursive: true });
		return json({ ok: true });
	}

	if (body.action === 'restore') {
		const targetBase = restoreTargets[body.kind];
		if (!targetBase) error(400, `Unknown kind: ${body.kind}`);
		const targetPath = resolve(targetBase, body.name);
		const targetDir = resolve(targetBase);
		if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
		if (existsSync(targetPath)) error(409, 'Item already exists at original location');
		renameSync(trashPath, targetPath);
		return json({ ok: true });
	}

	error(400, 'Invalid action');
};
