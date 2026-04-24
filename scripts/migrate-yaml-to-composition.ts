#!/usr/bin/env tsx
/**
 * One-time migration: convert YAML-based tutorials to composition.json.
 *
 * For each tutorial with a meta.yaml, produces a composition.json containing:
 *   - meta fields (slug, title, tags, thumbnail, sessions, author)
 *   - welcome / briefing
 *   - blocks from tutorial/round-NN.yaml as HandAuthoredBlocks
 *   - fullBlocks from full-log/round-NN.yaml as HandAuthoredBlocks
 *   - formatVersion: "1.0.0"
 *
 * Usage:
 *   tsx scripts/migrate-yaml-to-composition.ts [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

const TUTORIALS_DIR = resolve(import.meta.dirname, '../src/tutorials');
const DRY_RUN = process.argv.includes('--dry-run');

interface MetaYaml {
	slug: string;
	title: { en: string; ja?: string };
	tags?: string[];
	thumbnail?: string;
	sessions?: { id: string; imported?: boolean }[];
	author?: string;
	welcome?: {
		heading: { en: string; ja?: string };
		description: { en: string; ja?: string };
		learnings?: { en: string; ja?: string }[];
	};
	briefing?: { en: string; ja?: string };
	devOnly?: boolean;
}

function collectRoundFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => /^round-\d+\.yaml$/.test(f))
		.sort((a, b) => {
			const na = parseInt(a.match(/round-(\d+)/)?.[1] ?? '0', 10);
			const nb = parseInt(b.match(/round-(\d+)/)?.[1] ?? '0', 10);
			return na - nb;
		})
		.map((f) => join(dir, f));
}

function parseRoundYaml(path: string): unknown {
	const raw = readFileSync(path, 'utf-8');
	return yaml.load(raw);
}

const slugs = readdirSync(TUTORIALS_DIR).filter((name) => {
	const p = join(TUTORIALS_DIR, name);
	return statSync(p).isDirectory() && existsSync(join(p, 'meta.yaml'));
});

if (slugs.length === 0) {
	console.log('No tutorials with meta.yaml found.');
	process.exit(0);
}

console.log(`Found ${slugs.length} tutorial(s) to migrate: ${slugs.join(', ')}\n`);

for (const slug of slugs) {
	const tutorialDir = join(TUTORIALS_DIR, slug);
	const metaPath = join(tutorialDir, 'meta.yaml');
	const meta = yaml.load(readFileSync(metaPath, 'utf-8')) as MetaYaml;

	const tutorialRoundFiles = collectRoundFiles(join(tutorialDir, 'tutorial'));
	const fullLogRoundFiles = collectRoundFiles(join(tutorialDir, 'full-log'));

	const blocks = tutorialRoundFiles.map((f) => ({
		kind: 'round' as const,
		round: parseRoundYaml(f)
	}));

	const fullBlocks = fullLogRoundFiles.map((f) => ({
		kind: 'round' as const,
		round: parseRoundYaml(f)
	}));

	const composition: Record<string, unknown> = {
		formatVersion: '1.0.0',
		slug: meta.slug,
		meta: {
			slug: meta.slug,
			title: meta.title,
			tags: meta.tags ?? [],
			...(meta.thumbnail ? { thumbnail: meta.thumbnail } : {}),
			...(meta.sessions ? { sessions: meta.sessions } : {}),
			author: meta.author ?? 'Steffen Plunder'
		},
		...(meta.welcome ? { welcome: meta.welcome } : {}),
		...(meta.briefing ? { briefing: meta.briefing } : {}),
		...(meta.devOnly ? { devOnly: true } : {}),
		blocks
	};

	if (fullBlocks.length > 0) {
		composition.fullBlocks = fullBlocks;
	}

	const outPath = join(tutorialDir, 'composition.json');
	const json = JSON.stringify(composition, null, 2) + '\n';

	console.log(`${slug}:`);
	console.log(`  meta.yaml → composition.meta`);
	console.log(`  tutorial/ → ${blocks.length} block(s)`);
	console.log(`  full-log/ → ${fullBlocks.length} fullBlock(s)`);

	if (DRY_RUN) {
		console.log(`  [dry-run] Would write ${outPath}`);
	} else {
		writeFileSync(outPath, json, 'utf-8');
		console.log(`  ✓ Wrote ${outPath}`);
	}
	console.log();
}

console.log(DRY_RUN ? 'Dry run complete.' : 'Migration complete.');
