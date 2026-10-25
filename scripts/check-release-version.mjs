import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tag = process.env.GITHUB_REF_NAME;

if (!tag) throw new Error('GITHUB_REF_NAME is required when validating a release tag.');
if (tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match package version ${version}.`);
}

console.log(`Release tag ${tag} matches package version ${version}.`);
