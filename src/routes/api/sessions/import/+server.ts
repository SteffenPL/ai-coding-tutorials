import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import type { RequestHandler } from './$types';
import { SessionEvent } from '$lib/session/schema';

export const prerender = false;

function filterJsonl(raw: string): { filtered: string; kept: number; dropped: number } {
	const lines = raw.split('\n');
	const output: string[] = [];
	let kept = 0;
	let dropped = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const obj = JSON.parse(trimmed);
			const result = SessionEvent.safeParse(obj);
			if (result.success) {
				output.push(JSON.stringify(result.data));
				kept++;
			} else {
				dropped++;
			}
		} catch {
			dropped++;
		}
	}
	return { filtered: output.join('\n') + '\n', kept, dropped };
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const sessionPath = body.sessionPath as string;
	const slug = body.slug as string;

	if (!sessionPath || !slug) {
		error(400, 'Missing sessionPath or slug');
	}

	if (!existsSync(sessionPath)) {
		error(404, `Session file not found: ${sessionPath}`);
	}

	const sessionId = basename(sessionPath, '.jsonl');
	const outDir = resolve('src/sessions', slug);

	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true });
	}

	const raw = readFileSync(sessionPath, 'utf-8');
	const { filtered, kept, dropped } = filterJsonl(raw);
	writeFileSync(join(outDir, `${sessionId}.jsonl`), filtered, 'utf-8');

	// Import subagents if present
	const subagentDir = join(dirname(sessionPath), sessionId, 'subagents');
	let subagentCount = 0;
	if (existsSync(subagentDir)) {
		const outSubDir = join(outDir, sessionId, 'subagents');
		mkdirSync(outSubDir, { recursive: true });
		for (const file of readdirSync(subagentDir)) {
			if (file.endsWith('.jsonl')) {
				const subRaw = readFileSync(join(subagentDir, file), 'utf-8');
				const sub = filterJsonl(subRaw);
				writeFileSync(join(outSubDir, file), sub.filtered, 'utf-8');
				subagentCount++;
			} else if (file.endsWith('.meta.json')) {
				copyFileSync(join(subagentDir, file), join(outSubDir, file));
			}
		}
	}

	return json({
		ok: true,
		slug,
		sessionId,
		kept,
		dropped,
		subagentCount
	});
};
