import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadNeonPassword,
  readNeonSecretConfiguration,
} from '../dist/neon-secret.js';

const accountId = '123456789012';
const arn = `arn:aws:ssm:eu-north-1:${accountId}:parameter/platypus-service/production/neon/password`;
const environment = {
  AWS_REGION: 'eu-north-1',
  NEON_PASSWORD_PARAMETER_ARN: arn,
  NEON_PASSWORD_PARAMETER_VERSION: '7',
};
const password = 'Private-Fake-App-Password-Only-32';
const output = () => ({
  Parameter: {
    Name: '/platypus-service/production/neon/password',
    Type: 'SecureString',
    ARN: arn,
    Version: 7,
    Selector: ':7',
    Value: password,
  },
});
function fixture() {
  const state = {
    sends: 0,
    destroys: 0,
    factories: 0,
    run: async () => output(),
    factory(configuration) {
      state.factories++;
      state.configuration = configuration;
      return {
        send(command, options) {
          state.sends++;
          state.command = command;
          state.signal = options.abortSignal;
          return state.run();
        },
        destroy() {
          state.destroys++;
        },
      };
    },
  };
  return state;
}

test('SSM loader pins exact region/account/path/version, decryption and one bounded SDK attempt', async () => {
  const state = fixture();
  assert.equal(
    await loadNeonPassword({
      environment,
      accountId,
      clientFactory: state.factory,
    }),
    password,
  );
  assert.deepEqual(state.command.input, {
    Name: arn + ':7',
    WithDecryption: true,
  });
  assert.equal(state.configuration.region, 'eu-north-1');
  assert.equal(state.configuration.maxAttempts, 1);
  assert.equal(state.configuration.ignoreConfiguredEndpointUrls, true);
  assert.equal(state.configuration.requestHandler.connectionTimeout, 1000);
  assert.equal(state.configuration.requestHandler.requestTimeout, 2500);
  assert.equal(state.configuration.requestHandler.httpsAgent.keepAlive, false);
  assert.equal(state.configuration.logger, undefined);
  assert.equal(state.sends, 1);
  assert.equal(state.destroys, 1);
  assert.equal(state.signal.aborted, false);
});

test('missing/cross-account/unpinned/ambient-password cloud config is refused before client construction', async () => {
  for (const change of [
    { AWS_REGION: 'us-east-1' },
    { NEON_PASSWORD_PARAMETER_ARN: undefined },
    { NEON_PASSWORD_PARAMETER_ARN: arn.replace(accountId, '999999999999') },
    { NEON_PASSWORD_PARAMETER_ARN: arn + '/other' },
    { NEON_PASSWORD_PARAMETER_VERSION: '0' },
    { NEON_PASSWORD_PARAMETER_VERSION: '01' },
    { NEON_PASSWORD_PARAMETER_VERSION: 'latest' },
    { NEON_PASSWORD_PARAMETER_VERSION: '9007199254740992' },
    { NEON_PASSWORD: 'private' },
  ]) {
    const state = fixture();
    await assert.rejects(
      loadNeonPassword({
        environment: { ...environment, ...change },
        accountId,
        clientFactory: state.factory,
      }),
      { message: 'Neon runtime secret could not be loaded.' },
    );
    assert.equal(state.factories, 0);
  }
  assert.throws(() =>
    readNeonSecretConfiguration(
      {
        ...environment,
        NEON_PASSWORD_PARAMETER_ARN: arn.replace(accountId, '000000000000'),
      },
      '000000000000',
    ),
  );
  for (const timeoutMillis of [0, 3001, 1.5]) {
    const state = fixture();
    await assert.rejects(
      loadNeonPassword({
        environment,
        accountId,
        clientFactory: state.factory,
        timeoutMillis,
      }),
    );
    assert.equal(state.factories, 0);
  }
});

test('SDK response binding and printable private value validation fail closed without response/cause disclosure', async () => {
  for (const change of [
    { Type: 'String' },
    { ARN: arn + '/other' },
    { Name: 'wrong' },
    { Version: 8 },
    { Version: '7' },
    { Selector: ':latest' },
    { Value: '' },
    { Value: 'x'.repeat(19) },
    { Value: 'x'.repeat(129) },
    { Value: 'private-é-non-ascii-password' },
    { Value: 'x'.repeat(20) + '\0' },
  ]) {
    const state = fixture();
    state.run = async () => ({
      Parameter: { ...output().Parameter, ...change },
    });
    await assert.rejects(
      loadNeonPassword({
        environment,
        accountId,
        clientFactory: state.factory,
      }),
      (failure) => {
        assert.equal(
          failure.message,
          'Neon runtime secret could not be loaded.',
        );
        assert.equal(failure.cause, undefined);
        assert.equal(failure.code, undefined);
        return true;
      },
    );
    assert.equal(state.sends, 1);
    assert.equal(state.destroys, 1);
  }
});

test('permissions failure has no SDK retry or secret-bearing diagnostics; later explicit load may retry', async () => {
  const state = fixture();
  state.run = async () => {
    throw Object.assign(new Error(password), {
      name: 'AccessDeniedException',
      $metadata: { private: password },
    });
  };
  await assert.rejects(
    loadNeonPassword({ environment, accountId, clientFactory: state.factory }),
    { message: 'Neon runtime secret could not be loaded.' },
  );
  assert.equal(state.sends, 1);
  state.run = async () => output();
  assert.equal(
    await loadNeonPassword({
      environment,
      accountId,
      clientFactory: state.factory,
    }),
    password,
  );
  assert.equal(state.sends, 2);
  assert.equal(state.destroys, 2);
});

test('SDK deadline and parent cancellation abort once, destroy owned transport and observe late settlement', async () => {
  for (const parent of [false, true]) {
    const state = fixture();
    let late;
    state.run = () =>
      new Promise((resolve) => {
        late = resolve;
      });
    const controller = new AbortController();
    const pending = loadNeonPassword({
      environment,
      accountId,
      clientFactory: state.factory,
      timeoutMillis: 30,
      signal: controller.signal,
    });
    const rejected = assert.rejects(pending, {
      message: 'Neon runtime secret could not be loaded.',
    });
    if (parent) controller.abort();
    await rejected;
    assert.equal(state.signal.aborted, true);
    assert.equal(state.destroys, 1);
    assert.equal(state.sends, 1);
    late(output());
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state.destroys, 1);
  }
  const state = fixture(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadNeonPassword({
      environment,
      accountId,
      clientFactory: state.factory,
      signal: controller.signal,
    }),
  );
  assert.equal(state.factories, 0);
});
