import { validateTarget } from '../delivery/executor.mjs';
import { validateNeonArtifactSelection } from '../delivery/artifact-reader.mjs';
import { validateNeonRuntimeConfig } from './templates.mjs';

export function readCodeBuildInput(environment, sourceSha) {
  try {
    const parse = (name) => {
      const value = environment[name];
      if (typeof value !== 'string' || Buffer.byteLength(value) > 16384)
        throw new Error();
      return JSON.parse(value);
    };
    const target = validateTarget(parse('PLATYPUS_TARGET_JSON'));
    const selection = validateNeonArtifactSelection(
      parse('PLATYPUS_SELECTION_JSON'),
    );
    const runtime = validateNeonRuntimeConfig(parse('PLATYPUS_RUNTIME_JSON'));
    const exactKeys = (value, keys) => {
      if (
        JSON.stringify(Object.keys(value).sort()) !==
        JSON.stringify(keys.sort())
      )
        throw new Error();
    };
    exactKeys(target, [
      'project',
      'region',
      'accountId',
      'ownershipVerified',
      'serviceRoleArn',
      'lambdaExecutionRoleArn',
      'concurrency',
      'stacks',
      'resources',
    ]);
    exactKeys(target.concurrency, ['mode', 'acceptedSharedAccountCap']);
    exactKeys(target.stacks, ['storage', 'backend', 'edge']);
    exactKeys(target.resources, [
      'bucket',
      'bucketDomain',
      'functionArn',
      'aliasArn',
      'functionUrl',
      'distributionId',
      'origin',
    ]);
    exactKeys(selection, [
      'repository',
      'repositoryId',
      'repositoryOwnerId',
      'workflowPath',
      'ref',
      'sourceSha',
      'runId',
      'runAttempt',
      'artifactId',
      'artifactDigest',
      'manifestSha256',
      'release',
      'origin',
    ]);
    const publisher = environment.PLATYPUS_PUBLISHER_SHA;
    const transition = environment.PLATYPUS_ALLOW_NEON_TRANSITION;
    const projectArn = `arn:aws:codebuild:eu-north-1:${target.accountId}:project/platypus-service-publisher`;
    const buildPrefix = `arn:aws:codebuild:eu-north-1:${target.accountId}:build/platypus-service-publisher:`;
    if (
      environment.PLATYPUS_CONFIRM !== 'publish-neon' ||
      typeof publisher !== 'string' ||
      !/^[a-f0-9]{40}$/.test(publisher) ||
      /^0+$/.test(publisher) ||
      publisher !== sourceSha ||
      !['true', 'false'].includes(transition) ||
      Object.hasOwn(target, 'profile') ||
      environment.CODEBUILD_PROJECT_ARN !== projectArn ||
      !environment.CODEBUILD_BUILD_ARN?.startsWith(buildPrefix) ||
      !/^[a-f0-9-]{36}$/.test(
        environment.CODEBUILD_BUILD_ARN.slice(buildPrefix.length),
      ) ||
      runtime.accountId !== target.accountId ||
      runtime.region !== target.region ||
      runtime.origin !== target.resources.origin ||
      selection.origin !== runtime.origin
    )
      throw new Error();
    return {
      target,
      selection,
      runtime,
      allowNeonTransition: transition === 'true',
      buildId: environment.CODEBUILD_BUILD_ARN.slice(buildPrefix.length),
    };
  } catch {
    throw new Error(
      'CodeBuild publication requires explicit reviewed source, project, target, artifact and runtime inputs.',
    );
  }
}
