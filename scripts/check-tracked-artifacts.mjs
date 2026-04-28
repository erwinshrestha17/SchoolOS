import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const trackedFiles = execFileSync('git', ['ls-files'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const generatedArtifactPatterns = [
  /\.tsbuildinfo$/,
  /(^|\/)\.next\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)\.turbo\//,
  /(^|\/)\.cache\//,
];

const offenders = trackedFiles.filter(
  (file) =>
    existsSync(file) &&
    generatedArtifactPatterns.some((pattern) => pattern.test(file)),
);

if (offenders.length > 0) {
  console.error('Generated artifacts are tracked and must be removed:');
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}
