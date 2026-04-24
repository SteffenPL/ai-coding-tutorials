#!/usr/bin/env tsx
/**
 * Backfill: prepend a header event to existing imported session JSONL files.
 *
 * Usage:
 *   tsx scripts/backfill-session-headers.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { globSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

function findJsonlFiles(): string[] {
	const patterns = [
		'src/sessions/**/*.jsonl',
		'src/tutorials/*/session/**/*.jsonl'
	];
	const files: string[] = [];
	for (const pattern of patterns) {
		const matches = globSync(pattern, { cwd: ROOT, absolute: true });
		files.push(...matches);
	}
	return files;
}

function hasHeader(content: string): boolean {
	const firstLine = content.split('\n')[0];
	if (!firstLine) return false;
	try {
		const obj = JSON.parse(firstLine);
		return obj.type === 'header';
	} catch {
		return false;
	}
}

const files = findJsonlFiles();
if (files.length === 0) {
	console.log('No JSONL files found.');
	process.exit(0);
}

console.log(`Found ${files.length} JSONL file(s)\n`);

let updated = 0;
let skipped = 0;

for (const file of files) {
	const content = readFileSync(file, 'utf-8');
	const rel = file.replace(ROOT + '/', '');

	if (hasHeader(content)) {
		console.log(`  skip: ${rel} (already has header)`);
		skipped++;
		continue;
	}

	const sessionId = basename(file, '.jsonl');
	const header = JSON.stringify({
		type: 'header',
		formatVersion: '1.0.0',
		importDate: new Date().toISOString(),
		sourceSessionId: sessionId
	});

	if (DRY_RUN) {
		console.log(`  [dry-run] Would prepend header to: ${rel}`);
	} else {
		writeFileSync(file, header + '\n' + content, 'utf-8');
		console.log(`  ✓ ${rel}`);
	}
	updated++;
}

console.log(`\n${updated} updated, ${skipped} skipped.${DRY_RUN ? ' (dry run)' : ''}`);
