import { json, error } from '@sveltejs/kit';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { RequestHandler } from './$types';
import { detectProviderFromJsonl, normalizeSessionJsonl } from '$lib/session/providers';
import type { SessionProvider } from '$lib/session/normalized-schema';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const slug = formData.get('slug') as string | null;
	const parentSession = formData.get('parentSession') as string | null;
	const requestedProvider = (formData.get('provider') ?? 'auto') as SessionProvider | 'auto';

	if (!file || !slug) {
		error(400, 'Missing file or slug');
	}

	if (!file.name.endsWith('.jsonl')) {
		error(400, 'File must be a .jsonl file');
	}

	const raw = await file.text();
	const sessionId = file.name.replace(/\.jsonl$/, '');
	const provider = requestedProvider === 'auto' ? detectProviderFromJsonl(raw) : requestedProvider;
	const normalized = normalizeSessionJsonl(raw, {
		provider,
		sourceSessionId: sessionId,
		rawPath: parentSession ? `raw/${parentSession}/subagents/${file.name}` : `raw/${file.name}`
	});

	const outDir = parentSession ? resolve('src/sessions', parentSession, 'session', 'subagents') : resolve('src/sessions', slug);
	const rawDir = parentSession ? resolve('src/sessions', parentSession, 'raw', sessionId, 'subagents') : join(outDir, 'raw');

	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true });
	}
	if (!existsSync(rawDir)) {
		mkdirSync(rawDir, { recursive: true });
	}

	const outFile = parentSession
		? join(outDir, file.name)
		: join(outDir, 'session.jsonl');

	writeFileSync(join(rawDir, file.name), raw, 'utf-8');
	writeFileSync(outFile, normalized.events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');

	return json({
		ok: true,
		slug,
		sessionId,
		provider: normalized.provider,
		kept: normalized.kept,
		dropped: normalized.dropped,
		parentSession: parentSession ?? null
	});
};
