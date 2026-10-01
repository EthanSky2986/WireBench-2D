import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createPublicCandidate,
  excludedAssetHashes,
  isExcludedAssetPath,
  stripJpegMetadata,
} from './create-public-candidate.mjs';

function segment(marker, content) {
  const payload = Buffer.from(content);
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

const start = Buffer.from([0xff, 0xd8]);
const end = Buffer.from([0xff, 0xd9]);
const app0 = segment(0xe0, 'JFIF');
const icc = segment(0xe2, 'ICC_PROFILE');
const scan = segment(0xda, [1, 1, 0, 0, 63, 0]);
const pixels = Buffer.from([1, 2, 0xff, 0, 3, 0xff, 0xd0, 4]);
const cleanJpeg = Buffer.concat([start, app0, icc, scan, pixels, end]);
const metadataJpeg = Buffer.concat([
  start,
  app0,
  segment(0xe1, 'Exif private metadata'),
  icc,
  segment(0xed, 'Photoshop private metadata'),
  segment(0xfe, 'Comment private metadata'),
  scan,
  pixels,
  end,
]);

describe('JPEG metadata removal', () => {
  it('removes only APP1, APP13 and COM while preserving color and scan bytes', () => {
    const result = stripJpegMetadata(metadataJpeg);
    expect(result.removedSegments).toBe(3);
    expect(result.bytes.equals(cleanJpeg)).toBe(true);
    expect(stripJpegMetadata(result.bytes).removedSegments).toBe(0);
  });

  it('handles progressive scans, escaped FF and restart markers', () => {
    const input = Buffer.concat([
      start,
      app0,
      scan,
      pixels,
      segment(0xfe, 'between scans'),
      scan,
      pixels,
      end,
    ]);
    expect(stripJpegMetadata(input).bytes).toEqual(
      Buffer.concat([start, app0, scan, pixels, scan, pixels, end]),
    );
  });

  it.each([
    Buffer.from('not a jpeg'),
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 1, 0xff, 0xd9]),
    metadataJpeg.subarray(0, metadataJpeg.length - 1),
    Buffer.concat([cleanJpeg, Buffer.from('trailing private data')]),
  ])('rejects malformed or trailing data instead of silently exporting it', (bytes) => {
    expect(() => stripJpegMetadata(bytes)).toThrow();
  });
});

describe('reference asset exclusion', () => {
  it('rejects empty or invalid manifests', () => {
    expect(() => excludedAssetHashes('{"sha256":[]}')).toThrow();
    expect(() => excludedAssetHashes('{"sha256":["not-a-hash"]}')).toThrow();
  });

  it('allows documentation but rejects old reference image locations', () => {
    expect(isExcludedAssetPath('docs/references/README.md')).toBe(false);
    expect(isExcludedAssetPath('docs/references/nested/picture.PNG')).toBe(true);
    expect(isExcludedAssetPath('public/reference-bench.jpg')).toBe(true);
    expect(isExcludedAssetPath('docs/screenshots/main.jpg')).toBe(false);
  });
});

const temporaryDirectories = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function git(args, cwd) {
  return execFileSync(
    'git',
    ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
    {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Private fixture author',
        GIT_AUTHOR_EMAIL: 'private@example.invalid',
        GIT_COMMITTER_NAME: 'Private fixture author',
        GIT_COMMITTER_EMAIL: 'private@example.invalid',
      },
    },
  ).trim();
}

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'wirebench-export-test-'));
  temporaryDirectories.push(directory);
  const source = path.join(directory, 'source');
  const output = path.join(directory, 'output');
  await mkdir(path.join(source, 'scripts'), { recursive: true });
  await mkdir(path.join(source, 'docs/screenshots'), { recursive: true });
  await mkdir(output);
  await writeFile(
    path.join(source, 'scripts/excluded-assets.json'),
    JSON.stringify({ sha256: [createHash('sha256').update('private photo').digest('hex')] }),
  );
  await writeFile(path.join(source, 'docs/screenshots/main.jpg'), metadataJpeg);
  git(['init', '--initial-branch=main'], source);
  git(['add', '--all'], source);
  git(['commit', '-m', 'Private historical commit'], source);
  return { source, output };
}

// Real Git/tar subprocesses can exceed the default 5s on Windows CI.
// Scope the allowance to export integration tests; pure unit tests keep their default.
describe('public snapshot export', { timeout: 30_000 }, () => {
  it('creates a deterministic clean single-commit candidate with no private history or remote', async () => {
    const { source, output } = await fixture();
    git(['remote', 'add', 'origin', 'https://example.invalid/private'], source);
    const sourceSha = git(['rev-parse', 'HEAD'], source);
    const result = await createPublicCandidate(source, output);
    const candidate = result.candidateDirectory;
    expect(result.sourceSha).toBe(sourceSha);
    expect(result.before.rejectedFiles).toBe(0);
    expect(result.after.filesScanned).toBe(2);
    expect(git(['rev-list', '--count', 'HEAD'], candidate)).toBe('1');
    expect(git(['remote'], candidate)).toBe('');
    expect(git(['branch', '--show-current'], candidate)).toBe('main');
    expect(git(['log', '-1', '--format=%an <%ae>'], candidate)).toBe(
      'WireBench contributors <noreply@users.noreply.github.com>',
    );
    expect(await readFile(path.join(candidate, 'docs/screenshots/main.jpg'))).toEqual(cleanJpeg);
    expect(await readFile(path.join(source, 'docs/screenshots/main.jpg'))).toEqual(metadataJpeg);
    expect(git(['status', '--porcelain'], source)).toBe('');
    expect((await createPublicCandidate(source, output)).candidateSha).toBe(result.candidateSha);
  });

  it('rejects pending untracked changes', async () => {
    const { source, output } = await fixture();
    await writeFile(path.join(source, 'pending.txt'), 'untracked');
    await expect(createPublicCandidate(source, output)).rejects.toThrow('must be clean');
  });

  it('rejects a renamed supplied asset by content hash', async () => {
    const { source, output } = await fixture();
    await writeFile(path.join(source, 'renamed.bin'), 'private photo');
    git(['add', '--all'], source);
    git(['commit', '-m', 'Add renamed reference'], source);
    await expect(createPublicCandidate(source, output)).rejects.toThrow('renamed.bin');
  });

  it.each([
    'AGENTS.md',
    'PROJECT_PLAN.md',
    'docs/QUALITY_PLAN.md',
    'docs/VERIFICATION.md',
    'docs/OPEN_SOURCE_READINESS.md',
  ])('rejects an accidentally tracked internal document: %s', async (name) => {
    const { source, output } = await fixture();
    await writeFile(path.join(source, name), 'Internal working notes');
    git(['add', '--all'], source);
    git(['commit', '-m', 'Accidentally track internal notes'], source);
    await expect(createPublicCandidate(source, output)).rejects.toThrow(name);
  });

  it('leaves ignored local notes out while retaining public contributor documentation', async () => {
    const { source, output } = await fixture();
    await writeFile(path.join(source, '.gitignore'), '/AGENTS.md\n');
    await writeFile(path.join(source, 'AGENTS.md'), 'Local working notes');
    await writeFile(path.join(source, 'CONTRIBUTING.md'), 'Public contribution guide');
    git(['add', '--all'], source);
    git(['commit', '-m', 'Keep local notes private'], source);
    const result = await createPublicCandidate(source, output);
    await expect(readFile(path.join(result.candidateDirectory, 'AGENTS.md'))).rejects.toMatchObject(
      {
        code: 'ENOENT',
      },
    );
    expect(await readFile(path.join(source, 'AGENTS.md'), 'utf8')).toBe('Local working notes');
    expect(await readFile(path.join(result.candidateDirectory, 'CONTRIBUTING.md'), 'utf8')).toBe(
      'Public contribution guide',
    );
  });

  it('rejects symlinks rather than exporting links outside the snapshot', async () => {
    const { source, output } = await fixture();
    await symlink('../external-private-photo', path.join(source, 'linked-photo'));
    git(['add', '--all'], source);
    git(['commit', '-m', 'Add unsafe link'], source);
    await expect(createPublicCandidate(source, output)).rejects.toThrow('symlink');
  });

  it('rejects an output folder inside the source repository', async () => {
    const { source } = await fixture();
    await expect(createPublicCandidate(source, source)).rejects.toThrow('outside the source');
  });
});
