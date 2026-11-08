import { createLambdaHandler, type FunctionUrlResponse } from './lambda.js';
import { PostgresTicketRepository } from './postgres-ticket-repository.js';
import {
  createNeonConnection,
  type NeonConnection,
} from './neon-connection.js';
import {
  probeNeonConnection,
  readNeonRuntimeConfiguration,
} from './neon-runtime.js';
import {
  loadNeonPassword,
  readNeonSecretConfiguration,
} from './neon-secret.js';
import {
  allowedOriginsFromEnvironment,
  ticketError,
} from './ticket-application.js';

type Environment = Record<string, string | undefined>;
export interface NeonLambdaContext {
  invokedFunctionArn: string;
  getRemainingTimeInMillis(): number;
  callbackWaitsForEmptyEventLoop?: boolean;
}
interface Entry {
  controller: AbortController;
  connection?: NeonConnection;
  promise: Promise<NeonConnection>;
  retired: boolean;
  closePromise?: Promise<void>;
}
const unavailable = () => new Error('Neon Lambda request failed.');
const response = (): FunctionUrlResponse => ({
  ...ticketError(500, 'INTERNAL_ERROR', 'Tickets could not be loaded.'),
  isBase64Encoded: false,
});
function limit(value: number | undefined, maximum: number) {
  if (value === undefined) return maximum;
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw unavailable();
  return value;
}

export function createNeonLambdaHandler({
  environment = process.env,
  getPassword = loadNeonPassword,
  createConnection = createNeonConnection,
  requestTimeoutMillis,
  operationTimeoutMillis,
  cleanupTimeoutMillis,
}: {
  environment?: Environment;
  getPassword?: (options: {
    environment: Environment;
    accountId: string;
    signal: AbortSignal;
  }) => Promise<string>;
  createConnection?: (options: {
    environment: Environment;
    operationTimeoutMillis: number;
    closeTimeoutMillis: number;
  }) => NeonConnection;
  requestTimeoutMillis?: number;
  operationTimeoutMillis?: number;
  cleanupTimeoutMillis?: number;
} = {}) {
  const configured = { ...environment };
  const requestLimit = limit(requestTimeoutMillis, 25000);
  const operationLimit = limit(operationTimeoutMillis, 8000);
  const cleanupLimit = limit(cleanupTimeoutMillis, 3000);
  let current: Entry | undefined;
  let closed = false;
  let poisoned = false;
  let closing: Promise<void> = Promise.resolve();
  let closePromise: Promise<void> | undefined;
  function retire(entry: Entry): Promise<void> {
    if (entry.retired) return entry.closePromise ?? Promise.resolve();
    entry.retired = true;
    entry.controller.abort();
    if (current === entry) current = undefined;
    if (!entry.connection) return Promise.resolve();
    const connection = entry.connection;
    entry.closePromise = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(() => connection.close()),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(unavailable()), cleanupLimit);
          }),
        ]);
      } catch {
        poisoned = true;
      } finally {
        clearTimeout(timer);
      }
    })();
    closing = Promise.all([closing, entry.closePromise]).then(() => {});
    return entry.closePromise;
  }
  async function initialized(
    accountId: string,
    guard: () => void,
  ): Promise<Entry> {
    guard();
    if (closed || poisoned) throw unavailable();
    await closing;
    guard();
    if (closed || poisoned) throw unavailable();
    if (!current) {
      const entry: Entry = {
        controller: new AbortController(),
        retired: false,
        promise: Promise.resolve().then(async () => {
          try {
            readNeonSecretConfiguration(configured, accountId);
            // Validate the nonsecret target with the existing strict runtime parser;
            // this placeholder is private to validation, never a fallback credential.
            readNeonRuntimeConfiguration({
              ...configured,
              NEON_PASSWORD: 'validation-only-placeholder',
            });
            const password = await getPassword({
              environment: configured,
              accountId,
              signal: entry.controller.signal,
            });
            if (closed || entry.retired) throw unavailable();
            if (
              typeof password !== 'string' ||
              password.length < 20 ||
              password.length > 128 ||
              [...password].some(
                (character) =>
                  character.charCodeAt(0) < 32 || character.charCodeAt(0) > 126,
              )
            )
              throw unavailable();
            const configuration = readNeonRuntimeConfiguration({
              ...configured,
              NEON_PASSWORD: password,
            });
            entry.connection = createConnection({
              environment: configuration.environment,
              operationTimeoutMillis: operationLimit,
              closeTimeoutMillis: cleanupLimit,
            });
            await probeNeonConnection(entry.connection);
            if (closed || entry.retired) throw unavailable();
            return entry.connection;
          } catch {
            await retire(entry);
            throw unavailable();
          }
        }),
      };
      current = entry;
    }
    const entry = current;
    await entry.promise;
    guard();
    if (entry.retired || closed) throw unavailable();
    return entry;
  }
  const handler = async (
    event: unknown,
    context?: NeonLambdaContext,
  ): Promise<FunctionUrlResponse> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    let ownedEntry: Entry | undefined;
    let cancel: () => void = () => {};
    const cancellation = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(unavailable());
    });
    const guard = () => {
      if (expired || closed) throw unavailable();
    };
    try {
      if (!configured['ALLOWED_ORIGINS']) throw unavailable();
      const origins = allowedOriginsFromEnvironment(
        configured['ALLOWED_ORIGINS'],
      );
      if (
        origins.length !== 1 ||
        origins[0] !== configured['ALLOWED_ORIGINS'] ||
        !/^https:\/\/[a-z0-9]+\.cloudfront\.net$/.test(origins[0])
      )
        throw unavailable();
      const read = async <T>(
        work: (repository: PostgresTicketRepository) => Promise<T>,
      ): Promise<T> => {
        const match =
          /^arn:aws:lambda:eu-north-1:([0-9]{12}):function:[A-Za-z0-9_-]{1,64}(?::[A-Za-z0-9_$-]+)?$/.exec(
            context?.invokedFunctionArn ?? '',
          );
        const remaining = context?.getRemainingTimeInMillis();
        if (
          !match ||
          !Number.isInteger(remaining) ||
          remaining === undefined ||
          remaining <= 4000
        )
          throw unavailable();
        readNeonSecretConfiguration(configured, match[1]);
        context!.callbackWaitsForEmptyEventLoop = false;
        timer = setTimeout(
          () => {
            expired = true;
            const entry = ownedEntry ?? current;
            if (entry) void retire(entry);
            cancel();
          },
          Math.min(requestLimit, remaining - 4000),
        );
        const task = (async () => {
          ownedEntry = await initialized(match[1], guard);
          guard();
          return work(
            new PostgresTicketRepository({
              query: async (text, values) => {
                guard();
                if (ownedEntry!.retired) throw unavailable();
                const result = await ownedEntry!.connection!.query(
                  text,
                  values,
                );
                guard();
                if (ownedEntry!.retired) throw unavailable();
                return result;
              },
            }),
          );
        })();
        try {
          return await Promise.race([task, cancellation]);
        } catch {
          if (ownedEntry) void retire(ownedEntry);
          throw unavailable();
        }
      };
      return await createLambdaHandler({
        allowedOrigins: origins,
        logError: () => {},
        repository: {
          list: async () => {
            throw unavailable();
          },
          query: (query) => read((repository) => repository.query(query)),
          options: () => read((repository) => repository.options()),
        },
      })(event);
    } catch {
      return response();
    } finally {
      clearTimeout(timer);
    }
  };
  return Object.assign(handler, {
    close() {
      if (closePromise) return closePromise;
      closed = true;
      closePromise = current ? retire(current).then(() => closing) : closing;
      return closePromise;
    },
  });
}

// Factory construction snapshots configuration only. No SDK, pool or network I/O.
export const handler = createNeonLambdaHandler();
