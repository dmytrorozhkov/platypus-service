import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CompositeEngine,
  RuleFile,
  TemplateContent,
  TemplateFile,
  version,
} from '@aws/cloudformation-validate';

const root = fileURLToPath(new URL('../', import.meta.url));
const infrastructure = path.join(root, 'infrastructure');
const reportDirectory = path.join(root, '.local/aws-validation');
const rules = path.join(root, 'scripts/aws-policy.guard');
const engine = new CompositeEngine({ guardRules: [new RuleFile(rules)] });
const config = {
  pseudoParameterOverrides: {
    region: 'eu-north-1',
    accountId: '000000000000',
    stackName: 'platypus-validation',
    partition: 'aws',
    urlSuffix: 'amazonaws.com',
  },
};

try {
  // An insecure fixture must be rejected by the actual Guard evaluator.
  const insecure = engine.validateTemplate(
    new TemplateContent(
      JSON.stringify({
        Resources: {
          Bucket: { Type: 'AWS::S3::Bucket', Properties: {} },
          Url: {
            Type: 'AWS::Lambda::Url',
            Properties: { TargetFunctionArn: 'demo', AuthType: 'NONE' },
          },
          Logs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: { RetentionInDays: 365 },
          },
        },
      }),
      'insecure-validator-control.json',
    ),
    config,
  );
  assert(
    insecure.diagnostics.filter((entry) => entry.source === 'GUARD').length >=
      4,
    'All four Guard policy rules must reject the insecure control fixture.',
  );

  const paths = process.argv.slice(2);
  const templates = paths.length
    ? paths.map((entry) => path.resolve(root, entry))
    : (await readdir(infrastructure))
        .filter((entry) => entry.endsWith('.template.json'))
        .sort()
        .map((entry) => path.join(infrastructure, entry));
  assert(templates.length > 0, 'No CloudFormation templates selected.');
  const reports = [];
  for (const template of templates) {
    const content = await readFile(template, 'utf8');
    assert(Object.keys(JSON.parse(content).Resources ?? {}).length > 0);
    const report = engine.validateTemplate(new TemplateFile(template), config);
    const counts = {};
    for (const diagnostic of report.diagnostics) {
      counts[diagnostic.severity] = (counts[diagnostic.severity] ?? 0) + 1;
      console.log(
        `${path.relative(root, template)} ${diagnostic.severity} ${diagnostic.ruleId}: ${diagnostic.message}`,
      );
    }
    reports.push({ template: path.relative(root, template), counts, report });
    if (
      report.diagnostics.some((entry) =>
        ['ERROR', 'FATAL'].includes(entry.severity),
      )
    ) {
      process.exitCode = 1;
    }
    console.log(`${path.basename(template)}: ${JSON.stringify(counts)}`);
  }
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, 'report.json'),
    JSON.stringify(
      { validatorVersion: version(), region: 'eu-north-1', reports },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Offline schema/rule diagnostics saved to .local/aws-validation/report.json.',
  );
} finally {
  engine.free();
}
