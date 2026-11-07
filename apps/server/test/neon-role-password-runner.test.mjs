import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  access,
  copyFile,
} from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const execute = promisify(execFile);
const host = 'ep-owned-password.eu-central-1.aws.neon.tech';
const owner = 'Owner-Fixture-Password-Not-Real';
const app = "App-Fixture'Password\\Only-Not-Real-32";
const receipt = {
  operation: 'set-runtime-password',
  role: 'platypus_app',
  database: 'neondb',
  passwordConfigured: true,
};

async function fixture(t) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'platypus-owned-role-password-'),
  );
  await mkdir(path.join(directory, 'scripts'));
  await mkdir(path.join(directory, 'apps/server/database/neon'), {
    recursive: true,
  });
  await mkdir(path.join(directory, 'apps/server/dist'), { recursive: true });
  await writeFile(
    path.join(directory, 'package.json'),
    '{"name":"@platypus/workspace","type":"module"}',
  );
  await writeFile(
    path.join(directory, 'apps/server/dist/neon-connection.js'),
    '',
  );
  const script = path.join(directory, 'scripts/neon-role-password.ps1');
  await copyFile(path.join(root, 'scripts/neon-role-password.ps1'), script);
  await writeFile(
    path.join(directory, 'apps/server/database/neon/runtime-password.mjs'),
    `
    import assert from 'node:assert/strict';
    import {writeFile} from 'node:fs/promises';
    await writeFile('owned-child-started.txt', 'owned fake only');
    assert.deepEqual(process.argv.slice(2), ['set']);
    assert.equal(process.env.NEON_MIGRATION_HOST, ${JSON.stringify(host)});
    assert.equal(process.env.NEON_MIGRATION_CONFIRM_TARGET, ${JSON.stringify(host + '/neondb')});
    assert.equal(process.env.NEON_MIGRATION_PASSWORD, ${JSON.stringify(owner)});
    assert.equal(process.env.NEON_APP_NEW_PASSWORD, ${JSON.stringify(app)});
    assert.equal(process.env.NEON_PASSWORD, undefined);
    assert.equal(process.env.PGPASSWORD, undefined);
    assert(!process.argv.join(' ').includes(${JSON.stringify(owner)}));
    assert(!process.argv.join(' ').includes(${JSON.stringify(app)}));
    if(process.env.OWNED_PASSWORD_TEST_MODE==='leak') console.log(process.env.NEON_APP_NEW_PASSWORD);
    else if(process.env.OWNED_PASSWORD_TEST_MODE==='stderr') console.error(process.env.NEON_MIGRATION_PASSWORD);
    else if(process.env.OWNED_PASSWORD_TEST_MODE==='wrong') console.log(JSON.stringify({...${JSON.stringify(receipt)},extra:process.env.NEON_APP_NEW_PASSWORD}));
    else console.log(JSON.stringify(${JSON.stringify(receipt)}));
  `,
  );
  t.after(async () => {
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(os.tmpdir()),
    );
    assert(
      path.basename(directory).startsWith('platypus-owned-role-password-'),
    );
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, script };
}

async function run(
  { directory, script },
  { values = [host, host + '/neondb', owner, app, app], mode = '' } = {},
) {
  const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
  // Only public fake values are embedded in this owned test process. The real script
  // continues to use interactive hidden Read-Host; no real credentials are supplied.
  const setup =
    '$state=@{Index=0; Answers=[System.Collections.Generic.Queue[string]]::new()}; ' +
    values
      .map((value) => `$state.Answers.Enqueue(${literal(value)}); `)
      .join('') +
    "Set-Item Function:Read-Host ({param([string]$Prompt,[switch]$AsSecureString) if($state.Answers.Count -eq 0){throw 'Owned input exhausted'}; if([bool]$AsSecureString -ne ($state.Index -ge 2)){throw 'Owned secure mode differs'}; $state.Index++; $answer=$state.Answers.Dequeue(); if($AsSecureString){$s=[System.Security.SecureString]::new(); foreach($c in $answer.ToCharArray()){$s.AppendChar($c)}; $s.MakeReadOnly(); return $s}; return $answer}.GetNewClosure()); & " +
    literal(script);
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', setup],
    {
      cwd: directory,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NEON_MIGRATION_PASSWORD: 'Ambient-Owner-Sentinel',
        NEON_APP_NEW_PASSWORD: 'Ambient-App-Sentinel',
        NEON_PASSWORD: 'Ambient-Legacy-Sentinel',
        PGPASSWORD: 'Ambient-PG-Sentinel',
        OWNED_PASSWORD_TEST_MODE: mode,
      },
    },
  );
  let stdout = '',
    stderr = '',
    closed = false;
  child.stdout.on('data', (data) => {
    stdout += data;
  });
  child.stderr.on('data', (data) => {
    stderr += data;
  });
  child.stdin.on('error', () => {});
  child.stdin.end();
  const timer = setTimeout(() => {
    if (!closed)
      execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
      }).catch(() => {});
  }, 20000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => {
        closed = true;
        resolve(code);
      });
    });
    for (const secret of [
      owner,
      app,
      'Ambient-Owner-Sentinel',
      'Ambient-App-Sentinel',
      'Ambient-Legacy-Sentinel',
      'Ambient-PG-Sentinel',
      ...values.slice(2).filter((value) => value.length > 0),
    ]) {
      assert(
        !stdout.includes(secret),
        'Owned runner exposed a private fixture value.',
      );
      assert(
        !stderr.includes(secret),
        'Owned runner exposed a private fixture value.',
      );
    }
    return { code, stdout, stderr };
  } finally {
    clearTimeout(timer);
  }
}

test(
  'private role-password PowerShell supplies confirmed owner/app fields only and emits a fixed receipt',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const owned = await fixture(t);
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "$t=$null;$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('" +
          owned.script.replaceAll("'", "''") +
          "',[ref]$t,[ref]$e);if($e.Count){exit 1}",
      ],
      { windowsHide: true, timeout: 15000 },
    );
    const result = await run(owned);
    assert.equal(
      result.code,
      0,
      'Owned role-password runner did not return its fixed success receipt.',
    );
    assert(result.stdout.includes(JSON.stringify(receipt)));
    assert.equal(result.stderr, '');
    assert.equal(
      await readFile(
        path.join(owned.directory, 'owned-child-started.txt'),
        'utf8',
      ),
      'owned fake only',
    );
  },
);

test(
  'private role-password runner explains local input refusal with fixed codes before any child or remote attempt',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const short = 'Private-Short-Only';
    const long = 'Private-Long-Only-' + 'X'.repeat(128);
    const unicode = 'Private-Unicode-Only-é-1234567890';
    const control = 'Private-Control-Only-\t-1234567890';
    const confirmation = 'Private-Different-Confirmation-Only';
    for (const { values, diagnostic } of [
      {
        values: [host, host + '/neondb', '', app, app],
        diagnostic:
          '[NEON_PASSWORD_INPUT_OWNER_EMPTY] The owner password must not be empty.',
      },
      {
        values: [host, host + '/neondb', owner, '', ''],
        diagnostic:
          '[NEON_PASSWORD_INPUT_APP_LENGTH] The new app password must contain 20-128 characters.',
      },
      {
        values: [host, host + '/neondb', owner, short, short],
        diagnostic:
          '[NEON_PASSWORD_INPUT_APP_LENGTH] The new app password must contain 20-128 characters.',
      },
      {
        values: [host, host + '/neondb', owner, long, long],
        diagnostic:
          '[NEON_PASSWORD_INPUT_APP_LENGTH] The new app password must contain 20-128 characters.',
      },
      {
        values: [host, host + '/neondb', owner, app, confirmation],
        diagnostic:
          '[NEON_PASSWORD_INPUT_APP_CONFIRMATION] The repeated app password must match exactly.',
      },
      {
        values: [host, host + '/neondb', owner, app, 'X'.repeat(app.length)],
        diagnostic:
          '[NEON_PASSWORD_INPUT_APP_CONFIRMATION] The repeated app password must match exactly.',
      },
      {
        values: [host, host + '/neondb', owner, unicode, unicode],
        diagnostic:
          '[NEON_PASSWORD_INPUT_APP_ASCII] The new app password must use printable ASCII characters only.',
      },
      {
        values: [host, host + '/neondb', owner, control, control],
        diagnostic:
          '[NEON_PASSWORD_INPUT_APP_ASCII] The new app password must use printable ASCII characters only.',
      },
      {
        values: [host, host + '/neondb', owner, owner, owner],
        diagnostic:
          '[NEON_PASSWORD_INPUT_OWNER_REUSE] The app password must differ from the owner password.',
      },
    ]) {
      const owned = await fixture(t);
      const result = await run(owned, { values });
      assert.equal(result.code, 1);
      assert.equal(result.stderr, '');
      const lines = result.stdout.trim().split(/\r?\n/);
      assert.deepEqual(lines, [
        `Set only the existing platypus_app password at ${host}/neondb using neondb_owner.`,
        diagnostic,
        'No child process was started; no remote password operation was attempted.',
      ]);
      assert(!result.stdout.includes('passwordConfigured'));
      assert(!result.stdout.includes('Run the app connection check'));
      await assert.rejects(
        access(path.join(owned.directory, 'owned-child-started.txt')),
      );
    }
  },
);

test(
  'private role-password runner refuses mismatched confirmation and pooled targets before child execution',
  { skip: process.platform !== 'win32' },
  async (t) => {
    for (const values of [
      [
        host,
        host + '/neondb',
        owner,
        app,
        'Different-Private-Confirmation-Value',
      ],
      [host.replace('.', '-pooler.')],
    ]) {
      const owned = await fixture(t);
      const result = await run(owned, { values });
      assert.equal(result.code, 1);
      assert(!result.stdout.includes('"passwordConfigured":true'));
      await assert.rejects(
        access(path.join(owned.directory, 'owned-child-started.txt')),
      );
    }
  },
);

test(
  'private role-password runner never forwards unexpected child stdout, stderr or extra receipt fields',
  { skip: process.platform !== 'win32' },
  async (t) => {
    for (const mode of ['leak', 'stderr', 'wrong']) {
      const owned = await fixture(t);
      const result = await run(owned, { mode });
      assert.equal(result.code, 1);
      assert(!result.stdout.includes('"passwordConfigured":true'));
      assert(result.stdout.includes('setup was not confirmed'));
      assert(result.stdout.includes('[NEON_PASSWORD_RESULT_UNCONFIRMED]'));
      assert(
        result.stdout.includes(
          'Run the app connection check with the new password before explicitly retrying.',
        ),
      );
      assert(!result.stdout.includes('No child process was started'));
      assert.equal(
        await readFile(
          path.join(owned.directory, 'owned-child-started.txt'),
          'utf8',
        ),
        'owned fake only',
      );
    }
  },
);
