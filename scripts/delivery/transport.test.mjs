import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { createAwsCliTransport } from './transport.mjs';
import { readState } from './executor.mjs';

const bucket = 'platypus-test-delivery-artifacts';
const accountId = '111122223333';
const target = { accountId, resources: { bucket } };

// Model the streaming CLI contract, including literal argv and the final outfile.
test('object download uses explicit CLI options and returns binary bytes', async () => {
  const body = Buffer.from([0, 255, 13, 10, 65]);
  const key = '_releases/a file with spaces/*.json';
  let outfile;
  const transport = createAwsCliTransport({
    region: 'eu-north-1',
    profile: 'platypus-test',
    async executeCommand(executable, args, options) {
      assert.equal(executable, 'aws');
      assert.deepEqual(args.slice(0, 2), ['s3api', 'get-object']);
      assert.equal(args.includes('--cli-input-json'), false);
      const value = (flag) => args[args.indexOf(flag) + 1];
      assert.equal(value('--bucket'), bucket);
      assert.equal(value('--key'), key);
      assert.equal(value('--expected-bucket-owner'), accountId);
      assert.equal(value('--checksum-mode'), 'ENABLED');
      assert.equal(value('--profile'), 'platypus-test');
      assert.equal(options.shell, undefined);
      outfile = args.at(-1);
      assert.notEqual(outfile, 'platypus-test');
      await writeFile(outfile, body);
      return { stdout: JSON.stringify({ ETag: 'owned-etag' }) };
    },
  });
  const result = await transport.getObject({
    Bucket: bucket,
    Key: key,
    ExpectedBucketOwner: accountId,
  });
  assert.deepEqual(result.body, body);
  assert.equal(result.ETag, 'owned-etag');
  await assert.rejects(readFile(outfile), { code: 'ENOENT' });
});

test('first-import missing state is optional while access denial still stops', async () => {
  for (const code of ['NoSuchKey', 'AccessDenied']) {
    const transport = createAwsCliTransport({
      region: 'eu-north-1',
      async executeCommand(_executable, args) {
        // AWS CLI rejects JSON input for this streaming command before any API call.
        if (args.includes('--cli-input-json'))
          throw Object.assign(new Error('invalid CLI arguments'), {
            stderr: 'the following arguments are required: --bucket, --key',
          });
        throw Object.assign(new Error('request failed'), {
          stderr:
            'An error occurred (' +
            code +
            ') when calling the GetObject operation: private diagnostic',
        });
      },
    });
    if (code === 'NoSuchKey')
      assert.equal(await readState(transport, target, true), null);
    else
      await assert.rejects(readState(transport, target, true), (error) => {
        assert.equal(error.code, 'AccessDenied');
        assert.equal(error.message.includes('private diagnostic'), false);
        return true;
      });
  }
});

test('conditional object uploads retain JSON input and binary body files', async () => {
  const body = Buffer.from([0, 255, 65]);
  const transport = createAwsCliTransport({
    region: 'eu-north-1',
    async executeCommand(_executable, args) {
      assert.deepEqual(args.slice(0, 2), ['s3api', 'put-object']);
      const value = (flag) => args[args.indexOf(flag) + 1];
      const input = JSON.parse(
        await readFile(value('--cli-input-json').slice(7), 'utf8'),
      );
      assert.deepEqual(input, {
        Bucket: bucket,
        Key: '_releases/new.json',
        IfNoneMatch: '*',
      });
      assert.deepEqual(await readFile(value('--body')), body);
      return { stdout: JSON.stringify({ ETag: 'new-etag' }) };
    },
  });
  assert.deepEqual(
    await transport.putObject({
      Bucket: bucket,
      Key: '_releases/new.json',
      IfNoneMatch: '*',
      Body: body,
    }),
    { ETag: 'new-etag' },
  );
});
