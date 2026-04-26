import { expect, test } from '@playwright/test';

test.describe('session provider flows', () => {
	test('lists imported sessions on the log index', async ({ page }) => {
		await page.goto('/log');

		await expect(page.getByRole('heading', { name: 'Session Logs' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'install-claude-code' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Curate' }).first()).toBeVisible();
	});

	test('renders a session transcript from normalized or migrated logs', async ({ page }) => {
		await page.goto('/log/install-claude-code');

		await expect(page.getByRole('heading', { name: 'install-claude-code' })).toBeVisible();
		await expect(page.getByLabel('Session transcript')).toBeVisible();
		await expect(page.locator('.round-window').first()).toBeVisible();
		await expect(page.locator('.prompt-text').first()).toContainText(/\S/);
	});

	test('derives an editable trace from a session', async ({ page }) => {
		await page.goto('/curate/install-claude-code');

		await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
		await expect(page.getByLabel('Trace title')).toBeVisible();
		await expect(page.locator('.curate-layout')).toBeVisible();
	});

	test('renders the OpenAI Codex install tutorial', async ({ page }) => {
		await page.goto('/tutorials/install-openai-codex');

		await expect(page).toHaveTitle(/Install OpenAI Codex/);
		await expect(page.getByText('Install the Codex CLI')).toBeVisible();
		await expect(page.getByText('npm install -g @openai/codex')).toBeVisible();
		await expect(page.getByText('Create a small webpage showing a simulation')).toBeVisible();
	});
});
