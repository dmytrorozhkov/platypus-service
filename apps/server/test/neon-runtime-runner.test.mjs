import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const execute = promisify(execFile);

async function ownedFixture(t) {
  const prefix = path.join(os.tmpdir(), 'platypus-neon-runtime-wrapper-');
  const directory = await mkdtemp(prefix);
  await mkdir(path.join(directory, 'scripts'));
  await mkdir(path.join(directory, 'apps/server/dist'), { recursive: true });
  await writeFile(
    path.join(directory, 'package.json'),
    '{"name":"@platypus/workspace"}',
  );
  const script = path.join(directory, 'scripts/neon-runtime.ps1');
  await copyFile(path.join(root, 'scripts/neon-runtime.ps1'), script);
  await writeFile(
    path.join(directory, 'apps/server/dist/neon-main.js'),
    `
    const assert = require('node:assert/strict');
    assert.equal(process.argv[2], 'check');
    assert.equal(process.env.NEON_USER, 'platypus_app');
    assert.equal(process.env.NEON_DATABASE, 'neondb');
    assert.equal(process.env.NEON_PASSWORD, 'Owned-Password-Sentinel');
    assert.equal(process.env.NEON_HOST, 'ep-owned-example-pooler.eu-central-1.aws.neon.tech');
    assert.equal(process.env.NEON_CONFIRM_TARGET, process.env.NEON_HOST + '/neondb');
    assert.equal(process.env.PORT, '3002');
    assert.equal(process.env.ALLOWED_ORIGINS, 'http://localhost:5177');
    assert.equal(process.env.PGPASSWORD, undefined);
    assert(!process.argv.join(' ').includes('Owned-Password-Sentinel'));
    console.log('Neon connection check passed.');
  `,
  );
  t.after(async () => {
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(os.tmpdir()),
    );
    assert(
      path.basename(directory).startsWith('platypus-neon-runtime-wrapper-'),
    );
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, script };
}

async function run(script, directory, input) {
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      // Secure Read-Host requires an interactive console. Only the owned test process
      // substitutes prompt reads; the real wrapper/secure-string/child path executes.
      "function Read-Host { param([string]$Prompt,[switch]$AsSecureString) $answer=[Console]::In.ReadLine(); if($AsSecureString){ConvertTo-SecureString -String $answer -AsPlainText -Force}else{$answer} }; & '" +
        script.replaceAll("'", "''") +
        "' -Action check",
    ],
    {
      cwd: directory,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NEON_USER: 'neondb_owner',
        NEON_PASSWORD: 'Ambient-Password-Sentinel',
        PGPASSWORD: 'Ambient-Password-Sentinel',
      },
    },
  );
  let stdout = '';
  let stderr = '';
  let closed = false;
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  const timeout = setTimeout(() => {
    if (!closed)
      execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
      }).catch(() => {});
  }, 20000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (value) => {
        closed = true;
        resolve(value);
      });
    });
    return { code, stdout, stderr };
  } finally {
    clearTimeout(timeout);
  }
}

test(
  'real PowerShell runtime with substituted console prompts supplies only app fields and relays success',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const { directory, script } = await ownedFixture(t);
    const parsed = script.replaceAll("'", "''");
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "$tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('" +
          parsed +
          "',[ref]$tokens,[ref]$errors); if($errors.Count){exit 1}",
      ],
      { windowsHide: true },
    );
    const host = 'ep-owned-example-pooler.eu-central-1.aws.neon.tech';
    const result = await run(
      script,
      directory,
      `${host}\n${host}/neondb\nOwned-Password-Sentinel\n`,
    );
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert(result.stdout.includes('Neon connection check passed.'));
    // Read-Host secure input must never be relayed as cleartext stdout/stderr.
    assert(!result.stdout.includes('Owned-Password-Sentinel'));
    assert(!result.stderr.includes('Sentinel'));
    assert(!result.stdout.includes('Ambient-Password-Sentinel'));
  },
);

test(
  'real PowerShell runtime rejects URL/unknown target before any app password or child connection',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const { directory, script } = await ownedFixture(t);
    const result = await run(
      script,
      directory,
      'postgresql://Private-Password-Sentinel@wrong.invalid/db\n',
    );
    assert.equal(result.code, 1);
    assert(!result.stdout.includes('Neon connection check passed.'));
    assert(!result.stdout.includes('Private NEON password'));
    // Redirected Read-Host may echo its nonsecret hostname input; no password was requested or sent.
  },
);
