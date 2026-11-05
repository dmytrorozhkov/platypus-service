import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execute = promisify(execFile);
const operations = new Set([
  'sts/get-caller-identity',
  'freetier/get-account-plan-state',
  'lambda/get-account-settings',
  'lambda/get-alias',
  'lambda/get-function-configuration',
  'lambda/get-function-url-config',
  'lambda/get-function-concurrency',
  'cloudformation/describe-stacks',
  'cloudformation/list-stack-resources',
  'cloudformation/get-template',
  'cloudformation/create-change-set',
  'cloudformation/describe-change-set',
  'cloudformation/execute-change-set',
  'cloudfront/get-distribution',
  's3api/get-bucket-tagging',
  's3api/get-bucket-versioning',
  's3api/get-object',
  's3api/put-object',
]);

// Argument arrays and private temporary files keep JSON, bytes and credentials out of shell parsing.
export function createAwsCliTransport({ region, profile, executable = 'aws' }) {
  async function invoke(service, operation, input, extra = []) {
    if (!operations.has(`${service}/${operation}`))
      throw new Error('Unreviewed AWS operation.');
    const directory = await mkdtemp(path.join(os.tmpdir(), 'platypus-cli-'));
    try {
      const filename = path.join(directory, 'input.json');
      await writeFile(filename, JSON.stringify(input), { mode: 0o600 });
      const args = [
        service,
        operation,
        '--cli-input-json',
        'file://' + filename,
        '--region',
        service === 'freetier' ? 'us-east-1' : region,
        '--output',
        'json',
        '--no-cli-pager',
        '--no-cli-auto-prompt',
        ...extra,
      ];
      if (profile) args.push('--profile', profile);
      const result = await execute(executable, args, {
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off' },
      });
      return result.stdout.trim() ? JSON.parse(result.stdout) : {};
    } catch (error) {
      // Never echo AWS stderr, request bodies, signed URLs or credential material.
      const code =
        /\(([^)]+)\) when calling/.exec(error.stderr ?? '')?.[1] ??
        'CliFailure';
      const safe = new Error(`AWS ${service}/${operation} failed (${code}).`);
      safe.code = code;
      throw safe;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  return {
    request: invoke,
    async getObject(input) {
      const directory = await mkdtemp(
        path.join(os.tmpdir(), 'platypus-object-'),
      );
      try {
        const filename = path.join(directory, 'body');
        const result = await invoke(
          's3api',
          'get-object',
          { ...input, ChecksumMode: 'ENABLED' },
          [filename],
        );
        return { ...result, body: await readFile(filename) };
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    async putObject({ Body, ...input }) {
      if (!Buffer.isBuffer(Body)) throw new Error('Object Body must be bytes.');
      const directory = await mkdtemp(
        path.join(os.tmpdir(), 'platypus-object-'),
      );
      try {
        const filename = path.join(directory, 'body');
        await writeFile(filename, Body, { mode: 0o600 });
        return await invoke('s3api', 'put-object', input, ['--body', filename]);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
