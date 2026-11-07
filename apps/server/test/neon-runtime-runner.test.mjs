import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const execute = promisify(execFile);

const diagnosticStages = [
  'boot',
  'workspace',
  'prompt_host',
  'confirm_target',
  'resolve_node',
  'initialize_process',
  'prepare_environment',
  'prompt_password',
  'marshal_password',
  'start_child',
  'clear_password',
  'read_stdout',
  'read_stderr',
  'start_clock',
  'wait_child',
  'relay_stdout',
  'relay_stderr',
  'child_exit',
  'final_stdout',
  'forced_failure',
  'child_command',
  'child_identity',
  'child_password',
  'child_target',
  'child_runtime',
  'child_ambient',
  'child_arguments',
];

function copiedWrapperWithDiagnostics(source, forceFailure) {
  // Only this exclusively owned temporary copy is instrumented. No exception text,
  // argument, script source line, endpoint or environment value is emitted.
  source = source.replaceAll('\r\n', '\n');
  function replaceOnce(anchor, replacement) {
    const matches = [];
    for (
      let index = source.indexOf(anchor);
      index !== -1;
      index = source.indexOf(anchor, index + anchor.length)
    ) {
      if (index === 0 || source[index - 1] === '\n') matches.push(index);
    }
    assert(
      matches.length === 1,
      'Owned wrapper diagnostic anchor must remain unique.',
    );
    const [index] = matches;
    source =
      source.slice(0, index) +
      replacement +
      source.slice(index + anchor.length);
  }
  replaceOnce('$exitCode = 1\n', "$__fixtureStage = 'boot'\n$exitCode = 1\n");
  for (const [anchor, stage] of [
    ['  $projectRoot =', 'workspace'],
    ['  $selectedHost = Read-Host', 'prompt_host'],
    ['  $confirmation = Read-Host', 'confirm_target'],
    ['  $node = (Get-Command', 'resolve_node'],
    ['  $startInfo = New-Object', 'initialize_process'],
    [
      '  foreach ($name in $privateNames) { $startInfo.EnvironmentVariables.Remove($name) }\n',
      'prepare_environment',
    ],
    ['  $password = Read-Host', 'prompt_password'],
    [
      '  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR',
      'marshal_password',
    ],
    [
      '  try { $child = [Diagnostics.Process]::Start($startInfo) }',
      'start_child',
    ],
    [
      '    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)\n',
      'clear_password',
    ],
    ['  $stdoutTask = $child.StandardOutput.ReadLineAsync()', 'read_stdout'],
    ['  $stderrTask = $child.StandardError.ReadLineAsync()', 'read_stderr'],
    ['  $clock = [Diagnostics.Stopwatch]::StartNew()', 'start_clock'],
    ['  while (!$child.HasExited)', 'wait_child'],
    ['      $line = $stdoutTask.GetAwaiter().GetResult()', 'relay_stdout'],
    ['      $line = $stderrTask.GetAwaiter().GetResult()', 'relay_stderr'],
    ['  $exitCode = $child.ExitCode', 'child_exit'],
    ['    $line = $stdoutTask.GetAwaiter().GetResult()', 'final_stdout'],
  ])
    replaceOnce(anchor, `$__fixtureStage = '${stage}'\n${anchor}`);
  if (forceFailure)
    replaceOnce(
      '  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR',
      "$__fixtureStage = 'forced_failure'\n  throw 'Never-Print-This-Fixture-Exception-Value'\n  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR",
    );
  const catchAnchor =
    "} catch {\n  Write-Host 'The Neon backend runner did not complete.";
  replaceOnce(
    catchAnchor,
    "} catch {\n  Write-Host ('FIXTURE_DIAGNOSTIC stage={0} line={1} hresult={2}' -f $__fixtureStage, [int]$_.InvocationInfo.ScriptLineNumber, [int]$_.Exception.HResult)\n  Write-Host 'The Neon backend runner did not complete.",
  );
  return source;
}

function safeDiagnostic(result) {
  const lines = (result.stdout + '\n' + result.stderr).split(/\r?\n/);
  for (const line of lines) {
    const match =
      /^FIXTURE_DIAGNOSTIC stage=([a-z_]{1,32}) line=([0-9]{1,6}) hresult=(-?[0-9]{1,10})$/.exec(
        line,
      );
    if (!match || !diagnosticStages.includes(match[1])) continue;
    const scriptLine = Number(match[2]),
      hresult = Number(match[3]);
    if (scriptLine > 100000 || hresult < -2147483648 || hresult > 2147483647)
      continue;
    return `stage=${match[1]} line=${scriptLine} hresult=${hresult}`;
  }
  return 'stage=unknown line=0 hresult=0';
}

function annotateUnexpectedFailure(result) {
  const diagnostic = safeDiagnostic(result);
  // A fixed bounded annotation is readable anonymously; captured raw process output
  // must never be forwarded to Actions annotations or assertion messages.
  if (result.code !== 0)
    process.stdout.write(
      `::error title=Owned Neon wrapper diagnostic::${diagnostic}\n`,
    );
  return diagnostic;
}

async function ownedFixture(t, { forceFailure = false } = {}) {
  const prefix = path.join(os.tmpdir(), 'platypus-neon-runtime-wrapper-');
  const directory = await mkdtemp(prefix);
  await mkdir(path.join(directory, 'scripts'));
  await mkdir(path.join(directory, 'apps/server/dist'), { recursive: true });
  await writeFile(
    path.join(directory, 'package.json'),
    '{"name":"@platypus/workspace"}',
  );
  const script = path.join(directory, 'scripts/neon-runtime.ps1');
  await writeFile(
    script,
    copiedWrapperWithDiagnostics(
      await readFile(path.join(root, 'scripts/neon-runtime.ps1'), 'utf8'),
      forceFailure,
    ),
  );
  await writeFile(
    path.join(directory, 'apps/server/dist/neon-main.js'),
    `
    const assert = require('node:assert/strict');
    let stage = 'child_command';
    try {
    assert.equal(process.argv[2], 'check');
    stage = 'child_identity';
    assert.equal(process.env.NEON_USER, 'platypus_app');
    assert.equal(process.env.NEON_DATABASE, 'neondb');
    stage = 'child_password';
    assert.equal(process.env.NEON_PASSWORD, 'Owned-Password-Sentinel');
    stage = 'child_target';
    assert.equal(process.env.NEON_HOST, 'ep-owned-example-pooler.eu-central-1.aws.neon.tech');
    assert.equal(process.env.NEON_CONFIRM_TARGET, process.env.NEON_HOST + '/neondb');
    stage = 'child_runtime';
    assert.equal(process.env.PORT, '3002');
    assert.equal(process.env.ALLOWED_ORIGINS, 'http://localhost:5177');
    stage = 'child_ambient';
    assert.equal(process.env.PGPASSWORD, undefined);
    stage = 'child_arguments';
    assert(!process.argv.join(' ').includes('Owned-Password-Sentinel'));
    console.log('Neon connection check passed.');
    } catch {
      console.log('FIXTURE_DIAGNOSTIC stage=' + stage + ' line=0 hresult=0');
      process.exitCode = 1;
    }
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
    assert.equal(result.code, 0, annotateUnexpectedFailure(result));
    assert(result.stdout.includes('Neon connection check passed.'));
    // Read-Host secure input must never be relayed as cleartext stdout/stderr.
    assert(!result.stdout.includes('Owned-Password-Sentinel'));
    assert(!result.stderr.includes('Sentinel'));
    assert(!result.stdout.includes('Ambient-Password-Sentinel'));
  },
);

test(
  'owned wrapper instrumentation exposes only a fixed stage and numeric location/error under failure',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const { directory, script } = await ownedFixture(t, { forceFailure: true });
    const host = 'ep-owned-example-pooler.eu-central-1.aws.neon.tech';
    const result = await run(
      script,
      directory,
      `${host}\n${host}/neondb\nOwned-Password-Sentinel\n`,
    );
    assert.equal(result.code, 1);
    assert.match(
      safeDiagnostic(result),
      /^stage=forced_failure line=[1-9][0-9]{0,5} hresult=-?[0-9]{1,10}$/,
    );
    assert(!result.stdout.includes('Neon connection check passed.'));
    assert(!result.stdout.includes('Owned-Password-Sentinel'));
    assert(!result.stdout.includes('Ambient-Password-Sentinel'));
    assert(!result.stderr.includes('Sentinel'));
    assert(!result.stdout.includes('Never-Print-This-Fixture-Exception-Value'));
    assert(!result.stderr.includes('Never-Print-This-Fixture-Exception-Value'));
    assert.equal(
      safeDiagnostic({
        stdout: 'FIXTURE_DIAGNOSTIC stage=private_injected line=1 hresult=0',
        stderr: '',
      }),
      'stage=unknown line=0 hresult=0',
    );
    assert.equal(
      safeDiagnostic({
        stdout: 'FIXTURE_DIAGNOSTIC stage=boot line=1 hresult=2147483648',
        stderr: '',
      }),
      'stage=unknown line=0 hresult=0',
    );
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
