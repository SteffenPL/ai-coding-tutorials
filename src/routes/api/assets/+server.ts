import { json } from '@sveltejs/kit';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { RequestHandler } from './$types';

export const prerender = false;

function listFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isFile())
		.map((d) => d.name)
		.sort();
}

export const GET: RequestHandler = () => {
	const sharedDir = resolve('static/assets');
	const tutorialsBase = resolve('static/tutorials');

	const shared = listFiles(sharedDir);

	const tutorials: Record<string, string[]> = {};
	if (existsSync(tutorialsBase)) {
		for (const entry of readdirSync(tutorialsBase, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const assetsDir = join(tutorialsBase, entry.name, 'assets');
			const files = listFiles(assetsDir);
			if (files.length > 0) {
				tutorials[entry.name] = files;
			}
		}
	}

	return json({ shared, tutorials });
};
