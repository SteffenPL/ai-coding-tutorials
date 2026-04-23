import { json, error } from '@sveltejs/kit';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Buffer } from 'node:buffer';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	const slug = params.slug;
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) error(400, 'No file provided');

	const target = (formData.get('target') as string | null) ?? 'tutorial';
	const name = (formData.get('filename') as string | null) ?? file.name;
	const buffer = Buffer.from(await file.arrayBuffer());

	const isShared = target === 'shared';
	const assetsDir = isShared
		? resolve('static/assets')
		: resolve('static/tutorials', slug, 'assets');

	if (!existsSync(assetsDir)) {
		mkdirSync(assetsDir, { recursive: true });
	}

	writeFileSync(join(assetsDir, name), buffer);

	return json({
		ok: true,
		filename: isShared ? `shared/${name}` : name,
		path: isShared ? `assets/${name}` : `tutorials/${slug}/assets/${name}`
	});
};
