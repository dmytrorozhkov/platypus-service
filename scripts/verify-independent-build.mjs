import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { projectRoot } from './serve-local.mjs';

async function digest(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  const hash = createHash('sha256');
  for (const entry of entries
    .filter((entry) => entry.isFile())
    .sort((a, b) =>
      path
        .join(a.parentPath, a.name)
        .localeCompare(path.join(b.parentPath, b.name)),
    )) {
    hash.update(
      path.relative(directory, path.join(entry.parentPath, entry.name)),
    );
    hash.update(await readFile(path.join(entry.parentPath, entry.name)));
  }
  return hash.digest('hex');
}
async function rebuildAnalytics() {
  if (!process.env.npm_execpath)
    throw new Error('Run this check through npm run test:independent-build.');
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        process.env.npm_execpath,
        'run',
        'build',
        '--workspace',
        '@platypus/analytics',
      ],
      { cwd: projectRoot, stdio: 'inherit', windowsHide: true },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Analytics build failed.')),
    );
  });
}
const sourcePath = path.join(projectRoot, 'apps/analytics/src/App.tsx');
const original = await readFile(sourcePath, 'utf8');
const shellDirectory = path.join(projectRoot, 'apps/shell/dist/browser');
const vueDirectory = path.join(projectRoot, 'apps/administration/dist/remote');
const before = {
  shell: await digest(shellDirectory),
  administration: await digest(vueDirectory),
};
let browser;
try {
  assert(
    original.includes('A clear view of your support operations, in one place.'),
  );
  await writeFile(
    sourcePath,
    original.replace(
      'A clear view of your support operations, in one place.',
      'Independent Analytics build verified.',
    ),
  );
  await rebuildAnalytics();
  const candidates = [
    process.env.PLATYPUS_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  let executablePath;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      executablePath = candidate;
      break;
    } catch {
      /* A missing browser executable is handled by the next candidate. */
    }
  }
  if (!executablePath)
    throw new Error(
      'Set PLATYPUS_BROWSER to an installed Chromium executable.',
    );
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4200/analytics');
  await page
    .getByText('Independent Analytics build verified.', { exact: true })
    .waitFor();
  assert.equal(await digest(shellDirectory), before.shell);
  assert.equal(await digest(vueDirectory), before.administration);
  console.log(
    'PASS Changed Analytics content appears in Shell after a remote-only build.',
  );
  console.log(
    'PASS Shell and Administration build-directory hashes are unchanged.',
  );
  console.log(JSON.stringify(before, null, 2));
} finally {
  await browser?.close();
  await writeFile(sourcePath, original);
  await rebuildAnalytics();
  console.log('Original Analytics content restored and its remote rebuilt.');
}
