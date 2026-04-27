#!/usr/bin/env tsx
/**
 * Record a tutorial's slides route to video.
 *
 * Usage:
 *   tsx scripts/record-slides-video.ts <slug> [--height 360] [--width 640] [--theme dark-ocean] [--out videos] [--port 4173]
 *
 * Produces:
 *   <out>/<slug>-<height>p.webm  raw Playwright browser recording
 *   <out>/<slug>-<height>p.mp4   H.264 MP4 converted with ffmpeg
 */

import { chromium } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

interface Args {
	slug: string;
	width: number;
	height: number;
	outDir: string;
	port: number;
	timeoutMs: number;
	trimStart: number;
	theme: string;
}

function usage(): string {
	return `Usage: tsx scripts/record-slides-video.ts <slug> [--height 360] [--width 640] [--theme dark-ocean] [--out videos] [--port 4173] [--timeout 180000] [--trim-start 1.5]`;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		slug: '',
		width: 640,
		height: 360,
		outDir: 'videos',
		port: 4173,
		timeoutMs: 180_000,
		trimStart: 1.5,
		theme: ''
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--height') args.height = Number(argv[++i]);
		else if (arg === '--width') args.width = Number(argv[++i]);
		else if (arg === '--out') args.outDir = argv[++i];
		else if (arg === '--port') args.port = Number(argv[++i]);
		else if (arg === '--timeout') args.timeoutMs = Number(argv[++i]);
		else if (arg === '--trim-start') args.trimStart = Number(argv[++i]);
		else if (arg === '--theme') args.theme = argv[++i];
		else if (arg === '--help' || arg === '-h') {
			console.log(usage());
			process.exit(0);
		} else if (!args.slug) {
			args.slug = arg;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	if (!args.slug || !Number.isFinite(args.width) || !Number.isFinite(args.height)) {
		throw new Error(usage());
	}
	return args;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch {
			// Keep polling until Vite is ready.
		}
		await wait(250);
	}
	throw new Error(`Timed out waiting for dev server at ${url}`);
}

function startDevServer(port: number): ChildProcess {
	return spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
		stdio: ['ignore', 'pipe', 'pipe']
	});
}

async function runFfmpeg(
	webmPath: string,
	mp4Path: string,
	width: number,
	height: number,
	trimStart: number
): Promise<void> {
	const trimArgs = trimStart > 0 ? ['-ss', String(trimStart)] : [];
	await new Promise<void>((resolveRun, rejectRun) => {
		const ffmpeg = spawn('ffmpeg', [
			'-y',
			'-i',
			webmPath,
			...trimArgs,
			'-vf',
			`scale=${width}:${height}:flags=lanczos`,
			'-c:v',
			'libx264',
			'-pix_fmt',
			'yuv420p',
			'-movflags',
			'+faststart',
			'-crf',
			'22',
			mp4Path
		], { stdio: 'inherit' });

		ffmpeg.on('exit', (code) => {
			if (code === 0) resolveRun();
			else rejectRun(new Error(`ffmpeg exited with code ${code}`));
		});
		ffmpeg.on('error', rejectRun);
	});
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const outDir = resolve(args.outDir);
	mkdirSync(outDir, { recursive: true });
	const videoTempDir = mkdtempSync(resolve(tmpdir(), 'slides-video-'));

	const baseUrl = `http://127.0.0.1:${args.port}`;
	const server = startDevServer(args.port);
	let serverExited = false;
	server.on('exit', () => (serverExited = true));

	try {
		await waitForServer(baseUrl, 60_000);

		const browser = await chromium.launch({ headless: true });
		const context = await browser.newContext({
			viewport: { width: args.width, height: args.height },
			deviceScaleFactor: 1,
			recordVideo: {
				dir: videoTempDir,
				size: { width: args.width, height: args.height }
			}
		});

		const page = await context.newPage();
		const query = args.theme ? `?theme=${encodeURIComponent(args.theme)}` : '';
		const url = `${baseUrl}/slides/${args.slug}${query}`;
		await page.goto(url, { waitUntil: 'networkidle' });
		await page.waitForSelector('.slides-root', { timeout: 30_000 });
		await page.waitForSelector('.pause-badge', { timeout: args.timeoutMs });
		await page.waitForTimeout(1000);

		const video = page.video();
		await context.close();
		await browser.close();

		const sourcePath = await video.path();
		const themeSuffix = args.theme ? `-${args.theme}` : '';
		const stem = `${args.slug}${themeSuffix}-${args.height}p`;
		const webmPath = resolve(outDir, `${stem}.webm`);
		const mp4Path = resolve(outDir, `${stem}.mp4`);
		copyFileSync(sourcePath, webmPath);

		await runFfmpeg(webmPath, mp4Path, args.width, args.height, args.trimStart);

		if (!existsSync(mp4Path)) throw new Error(`Expected MP4 was not created: ${mp4Path}`);
		console.log(`\nRecorded ${url}`);
		console.log(`WebM: ${webmPath}`);
		console.log(`MP4:  ${mp4Path}`);
	} finally {
		if (!serverExited) server.kill('SIGINT');
		rmSync(videoTempDir, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
