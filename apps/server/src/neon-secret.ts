import {
  GetParameterCommand,
  SSMClient,
  type GetParameterCommandOutput,
  type SSMClientConfig,
} from '@aws-sdk/client-ssm';

type Environment = Record<string, string | undefined>;
interface SecretClient {
  send(
    command: GetParameterCommand,
    options: { abortSignal: AbortSignal },
  ): Promise<GetParameterCommandOutput>;
  destroy(): void;
}
const unavailable = () => new Error('Neon runtime secret could not be loaded.');
export function readNeonSecretConfiguration(
  environment: Environment,
  accountId: string,
) {
  const arn = environment['NEON_PASSWORD_PARAMETER_ARN'];
  const version = environment['NEON_PASSWORD_PARAMETER_VERSION'];
  if (
    environment['AWS_REGION'] !== 'eu-north-1' ||
    environment['NEON_PASSWORD'] !== undefined ||
    !/^[0-9]{12}$/.test(accountId) ||
    accountId === '000000000000' ||
    arn !==
      `arn:aws:ssm:eu-north-1:${accountId}:parameter/platypus-service/production/neon/password` ||
    typeof version !== 'string' ||
    !/^[1-9][0-9]*$/.test(version) ||
    !Number.isSafeInteger(Number(version))
  )
    throw unavailable();
  return {
    arn,
    version: Number(version),
    name: '/platypus-service/production/neon/password',
  };
}

export async function loadNeonPassword({
  environment = process.env,
  accountId,
  signal,
  clientFactory = (configuration) => new SSMClient(configuration),
  timeoutMillis = 3000,
}: {
  environment?: Environment;
  accountId: string;
  signal?: AbortSignal;
  clientFactory?: (configuration: SSMClientConfig) => SecretClient;
  timeoutMillis?: number;
}): Promise<string> {
  let client: SecretClient | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  let cancel: () => void = () => {};
  const abort = () => {
    controller.abort();
    cancel();
  };
  try {
    const configuration = readNeonSecretConfiguration(environment, accountId);
    if (
      !Number.isInteger(timeoutMillis) ||
      timeoutMillis < 1 ||
      timeoutMillis > 3000 ||
      signal?.aborted
    )
      throw unavailable();
    const cancellation = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(unavailable());
    });
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(abort, timeoutMillis);
    client = clientFactory({
      region: 'eu-north-1',
      maxAttempts: 1,
      ignoreConfiguredEndpointUrls: true,
      requestHandler: {
        connectionTimeout: 1000,
        socketTimeout: 2500,
        requestTimeout: 2500,
        httpsAgent: { keepAlive: false, maxSockets: 1 },
      },
    });
    const response = await Promise.race([
      client.send(
        new GetParameterCommand({
          Name: configuration.arn + ':' + configuration.version,
          WithDecryption: true,
        }),
        { abortSignal: controller.signal },
      ),
      cancellation,
    ]);
    if (controller.signal.aborted) throw unavailable();
    const parameter = response.Parameter;
    const password = parameter?.Value;
    if (
      parameter?.Type !== 'SecureString' ||
      parameter.ARN !== configuration.arn ||
      parameter.Name !== configuration.name ||
      parameter.Version !== configuration.version ||
      (parameter.Selector !== undefined &&
        parameter.Selector !== ':' + configuration.version) ||
      typeof password !== 'string' ||
      password.length < 20 ||
      password.length > 128 ||
      [...password].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) > 126,
      )
    )
      throw unavailable();
    return password;
  } catch {
    throw unavailable();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    try {
      client?.destroy();
    } catch {
      /* Owned cleanup never exposes SDK values. */
    }
  }
}
