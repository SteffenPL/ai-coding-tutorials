import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import type { RequestHandler } from './$types';
import { detectProviderFromJsonl, normalizeSessionJsonl } from '$lib/session/providers';
import type { SessionProvider } from '$lib/session/normalized-schema';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const sessionPath = body.sessionPath as string;
	const slug = body.slug as string;
	const requestedProvider = (body.provider ?? 'auto') as SessionProvider | 'auto';

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
	const provider = requestedProvider === 'auto' ? detectProviderFromJsonl(raw) : requestedProvider;
	const normalized = normalizeSessionJsonl(raw, {
		provider,
		sourceSessionId: sessionId,
		rawPath: `raw/${basename(sessionPath)}`
	});
	const rawDir = join(outDir, 'raw');
	mkdirSync(rawDir, { recursive: true });
	copyFileSync(sessionPath, join(rawDir, basename(sessionPath)));
	writeFileSync(
		join(outDir, 'session.jsonl'),
		normalized.events.map((e) => JSON.stringify(e)).join('\n') + '\n',
		'utf-8'
	);

	// Import subagents if present
	const subagentDir = join(dirname(sessionPath), sessionId, 'subagents');
	let subagentCount = 0;
	if (existsSync(subagentDir) && normalized.provider === 'claude') {
		const outSubDir = join(outDir, 'session', 'subagents');
		const rawSubDir = join(rawDir, sessionId, 'subagents');
		mkdirSync(outSubDir, { recursive: true });
		mkdirSync(rawSubDir, { recursive: true });
		for (const file of readdirSync(subagentDir)) {
			if (file.endsWith('.jsonl')) {
				const subRaw = readFileSync(join(subagentDir, file), 'utf-8');
				const sub = normalizeSessionJsonl(subRaw, {
					provider: 'claude',
					sourceSessionId: file.replace(/^agent-/, '').replace(/\.jsonl$/, ''),
					rawPath: `raw/${sessionId}/subagents/${file}`
				});
				copyFileSync(join(subagentDir, file), join(rawSubDir, file));
				writeFileSync(
					join(outSubDir, file),
					sub.events.map((e) => JSON.stringify(e)).join('\n') + '\n',
					'utf-8'
				);
				subagentCount++;
			} else if (file.endsWith('.meta.json')) {
				copyFileSync(join(subagentDir, file), join(rawSubDir, file));
				copyFileSync(join(subagentDir, file), join(outSubDir, file));
			}
		}
	}

	return json({
		ok: true,
		slug,
		sessionId,
		provider: normalized.provider,
		kept: normalized.kept,
		dropped: normalized.dropped,
		subagentCount
	});
};
