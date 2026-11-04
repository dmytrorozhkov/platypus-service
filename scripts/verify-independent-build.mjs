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
const support = process.argv.includes('--support');
const workspace = support ? '@platypus/support' : '@platypus/analytics';
const sentence = support
  ? 'A shared view of incoming support requests.'
  : 'A clear view of your support operations, in one place.';
const replacement = support
  ? 'Independent Support build verified.'
  : 'Independent Analytics build verified.';
async function rebuildRemote() {
  if (!process.env.npm_execpath)
    throw new Error('Run this check through npm run test:independent-build.');
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [process.env.npm_execpath, 'run', 'build', '--workspace', workspace],
      { cwd: projectRoot, stdio: 'inherit', windowsHide: true },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(workspace + ' build failed.')),
    );
  });
}
const sourcePath = path.join(
  projectRoot,
  support ? 'apps/support/src/app/support.html' : 'apps/analytics/src/App.tsx',
);
const original = await readFile(sourcePath, 'utf8');
const shellDirectory = path.join(projectRoot, 'apps/shell/dist/browser');
const vueDirectory = path.join(projectRoot, 'apps/administration/dist/remote');
const otherRemoteDirectory = path.join(
  projectRoot,
  support ? 'apps/analytics/dist/remote' : 'apps/support/dist/browser',
);
const before = {
  shell: await digest(shellDirectory),
  administration: await digest(vueDirectory),
  otherRemote: await digest(otherRemoteDirectory),
};
let browser;
try {
  assert(original.includes(sentence));
  await writeFile(sourcePath, original.replace(sentence, replacement));
  await rebuildRemote();
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
  await page.goto(
    'http://localhost:4200/' + (support ? 'support/tickets' : 'analytics'),
  );
  await page.getByText(replacement, { exact: true }).waitFor();
  assert.equal(await digest(shellDirectory), before.shell);
  assert.equal(await digest(vueDirectory), before.administration);
  assert.equal(await digest(otherRemoteDirectory), before.otherRemote);
  console.log(
    'PASS Changed ' +
      workspace +
      ' content appears in Shell after a remote-only build.',
  );
  console.log(
    'PASS Shell and both other remote build-directory hashes are unchanged.',
  );
  console.log(JSON.stringify(before, null, 2));
} finally {
  await browser?.close();
  await writeFile(sourcePath, original);
  await rebuildRemote();
  console.log(
    'Original ' + workspace + ' content restored and its remote rebuilt.',
  );
}
