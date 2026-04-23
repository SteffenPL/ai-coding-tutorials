import { json, error } from '@sveltejs/kit';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Buffer } from 'node:buffer';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const assetsDir = resolve('static/assets');

	if (!existsSync(assetsDir)) {
		mkdirSync(assetsDir, { recursive: true });
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) error(400, 'No file provided');

	const filename = (formData.get('filename') as string | null) ?? file.name;
	const buffer = Buffer.from(await file.arrayBuffer());
	const filepath = join(assetsDir, filename);

	writeFileSync(filepath, buffer);

	return json({
		ok: true,
		filename: `shared/${filename}`,
		path: `assets/${filename}`
	});
};
