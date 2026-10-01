import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const manifestPath = 'scripts/excluded-assets.json';
const imageExtension = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i;
const internalDocumentPaths = new Set([
  'agents.md',
  'project_plan.md',
  'docs/quality_plan.md',
  'docs/verification.md',
  'docs/open_source_readiness.md',
]);

function run(command, args, cwd, env) {
  return execFileSync(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function git(args, cwd, env) {
  return run('git', ['-c', 'core.quotePath=false', ...args], cwd, env);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function excludedAssetHashes(content) {
  const manifest = JSON.parse(content);
  if (
    !manifest ||
    !Array.isArray(manifest.sha256) ||
    manifest.sha256.length === 0 ||
    manifest.sha256.some((hash) => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))
  ) {
    throw new Error(`${manifestPath} must contain a nonempty sha256 array of lowercase hashes.`);
  }
  return new Set(manifest.sha256);
}

export function isExcludedAssetPath(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
  return (
    normalized === 'public/reference-bench.jpg' ||
    (normalized.startsWith('docs/references/') && imageExtension.test(normalized))
  );
}

export function isInternalDocumentPath(relativePath) {
  return internalDocumentPaths.has(relativePath.replaceAll('\\', '/').toLowerCase());
}

/** Remove EXIF/XMP, IPTC/Photoshop and comments without re-encoding JPEG scan data. */
export function stripJpegMetadata(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Invalid JPEG start marker.');
  }
  const pieces = [bytes.subarray(0, 2)];
  let offset = 2;
  let removedSegments = 0;
  while (offset < bytes.length) {
    const start = offset;
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker boundary.');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0 || marker === 0xd8) {
      throw new Error('Invalid JPEG marker.');
    }
    if (marker === 0xd9) {
      if (offset !== bytes.length) throw new Error('Unexpected data after JPEG end marker.');
      pieces.push(bytes.subarray(start, offset));
      return { bytes: Buffer.concat(pieces), removedSegments };
    }
    if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) {
      pieces.push(bytes.subarray(start, offset));
      continue;
    }
    if (offset + 2 > bytes.length) throw new Error('Truncated JPEG segment length.');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) {
      throw new Error('Invalid JPEG segment length.');
    }
    offset += length;
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) removedSegments++;
    else pieces.push(bytes.subarray(start, offset));

    if (marker === 0xda) {
      const scanStart = offset;
      // Entropy-coded data can contain escaped FF bytes and restart markers.
      // Preserve them, and stop only at the next actual marker (including another scan).
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        let codeOffset = offset + 1;
        while (bytes[codeOffset] === 0xff) codeOffset++;
        const code = bytes[codeOffset];
        if (code === 0 || (code >= 0xd0 && code <= 0xd7)) {
          offset = codeOffset + 1;
          continue;
        }
        break;
      }
      pieces.push(bytes.subarray(scanStart, offset));
    }
  }
  throw new Error('JPEG end marker is missing.');
}

async function candidateFiles(directory, relativeDirectory = '') {
  const result = [];
  for (const entry of await readdir(path.join(directory, relativeDirectory), {
    withFileTypes: true,
  })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) result.push(...(await candidateFiles(directory, relativePath)));
    else if (entry.isFile()) result.push(relativePath);
    else throw new Error(`Unsupported exported file type: ${relativePath}`);
  }
  return result.sort();
}

async function scanFiles(directory, files, excludedHashes) {
  const rejected = [];
  for (const relativePath of files) {
    const bytes = await readFile(path.join(directory, relativePath));
    if (
      isExcludedAssetPath(relativePath) ||
      isInternalDocumentPath(relativePath) ||
      excludedHashes.has(sha256(bytes))
    ) {
      rejected.push(relativePath);
    }
  }
  if (rejected.length) throw new Error(`Excluded public files found:\n${rejected.join('\n')}`);
  return { filesScanned: files.length, excludedHashes: excludedHashes.size, rejectedFiles: 0 };
}

function requireCleanCheckout(sourceDirectory) {
  if (git(['status', '--porcelain=v1', '--untracked-files=all'], sourceDirectory)) {
    throw new Error(
      'Source checkout must be clean. Commit or otherwise resolve pending changes first.',
    );
  }
}

export async function createPublicCandidate(sourceDirectory, temporaryDirectory = tmpdir()) {
  sourceDirectory = await realpath(git(['rev-parse', '--show-toplevel'], sourceDirectory));
  requireCleanCheckout(sourceDirectory);
  const sourceSha = git(['rev-parse', 'HEAD'], sourceDirectory);
  const sourceDate = git(['show', '-s', '--format=%cI', sourceSha], sourceDirectory);
  const tree = git(['ls-tree', '-rz', '--full-tree', sourceSha], sourceDirectory);
  for (const entry of tree.split('\0').filter(Boolean)) {
    if (!/^(100644|100755) blob /.test(entry)) {
      throw new Error(`Source contains a symlink, submodule or unsupported file mode: ${entry}`);
    }
  }
  const resolvedTemporaryDirectory = await realpath(temporaryDirectory);
  const relativeTemporaryDirectory = path.relative(sourceDirectory, resolvedTemporaryDirectory);
  if (
    !relativeTemporaryDirectory ||
    (!relativeTemporaryDirectory.startsWith(`..${path.sep}`) &&
      relativeTemporaryDirectory !== '..' &&
      !path.isAbsolute(relativeTemporaryDirectory))
  ) {
    throw new Error('The temporary output directory must be outside the source repository.');
  }

  const candidateDirectory = await mkdtemp(
    path.join(resolvedTemporaryDirectory, 'wirebench-public-'),
  );
  const archiveDirectory = await mkdtemp(
    path.join(resolvedTemporaryDirectory, 'wirebench-archive-'),
  );
  try {
    const archiveFile = path.join(archiveDirectory, 'snapshot.tar');
    git(['archive', '--format=tar', `--output=${archiveFile}`, sourceSha], sourceDirectory);
    run('tar', ['-xf', archiveFile, '-C', candidateDirectory], sourceDirectory);

    const excludedHashes = excludedAssetHashes(
      await readFile(path.join(candidateDirectory, manifestPath), 'utf8'),
    );
    const files = await candidateFiles(candidateDirectory);
    // Scan original exported bytes before stripping: renamed copies cannot evade the denylist.
    const before = await scanFiles(candidateDirectory, files, excludedHashes);
    const screenshots = [];
    for (const relativePath of files) {
      if (!/^docs\/screenshots\/.*\.jpe?g$/i.test(relativePath)) continue;
      const file = path.join(candidateDirectory, relativePath);
      const result = stripJpegMetadata(await readFile(file));
      if (result.removedSegments) await writeFile(file, result.bytes);
      screenshots.push({ path: relativePath, removedSegments: result.removedSegments });
    }
    const after = await scanFiles(candidateDirectory, files, excludedHashes);

    // The candidate's Git history begins only after all export checks have passed.
    const commitEnvironment = {
      GIT_AUTHOR_NAME: 'WireBench contributors',
      GIT_AUTHOR_EMAIL: 'noreply@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'WireBench contributors',
      GIT_COMMITTER_EMAIL: 'noreply@users.noreply.github.com',
      GIT_AUTHOR_DATE: sourceDate,
      GIT_COMMITTER_DATE: sourceDate,
    };
    git(['init', '--initial-branch=main'], candidateDirectory);
    git(['-c', 'core.autocrlf=false', 'add', '--all', '--force'], candidateDirectory);
    git(
      [
        '-c',
        `core.hooksPath=${path.join(archiveDirectory, 'no-hooks')}`,
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-m',
        'Initial public candidate',
      ],
      candidateDirectory,
      commitEnvironment,
    );
    if (git(['remote'], candidateDirectory))
      throw new Error('Candidate unexpectedly has a remote.');
    const candidateSha = git(['rev-parse', 'HEAD'], candidateDirectory);
    return { candidateDirectory, sourceSha, candidateSha, before, after, screenshots };
  } catch (error) {
    await rm(candidateDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(archiveDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await createPublicCandidate(path.dirname(fileURLToPath(import.meta.url)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Public candidate was not created: ${error.message}\n`);
    process.exitCode = 1;
  }
}
