import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./check-git-identities.mjs', import.meta.url));
const rejectedEmail = 'noreply@users.noreply.github.com';
const ownerEmail = '233899013+EthanSky2986@users.noreply.github.com';
const zeros = '0'.repeat(40);
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'wirebench identities-'));
  temporaryDirectories.push(cwd);
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(cwd, 'unused-global-config'),
    GIT_AUTHOR_NAME: 'Fixture author',
    GIT_AUTHOR_EMAIL: ownerEmail,
    GIT_COMMITTER_NAME: 'Fixture committer',
    GIT_COMMITTER_EMAIL: 'noreply@github.com',
  };
  // Inherited repository variables must not redirect test Git operations.
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_CONFIG_COUNT',
  ]) {
    delete env[key];
  }
  function git(args, overrides = {}) {
    return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
      cwd,
      env: { ...env, ...overrides },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
  function commit(overrides = {}, message = 'Fixture commit') {
    git(['commit', '--allow-empty', '-m', message], overrides);
    return git(['rev-parse', 'HEAD']);
  }
  function check(args = [], options = {}) {
    return spawnSync(process.execPath, [script, ...args], {
      cwd,
      env: { ...env, ...options.env },
      encoding: 'utf8',
      input: options.input ?? '',
    });
  }
  function hook(name, options = {}) {
    const hookPath = fileURLToPath(new URL(`../.githooks/${name}`, import.meta.url));
    return spawnSync('sh', [hookPath], {
      cwd,
      env: { ...env, ...options.env },
      encoding: 'utf8',
      input: options.input ?? '',
    });
  }
  git(['init', '--initial-branch=main']);
  return { cwd, git, commit, check, hook };
}

function pushRecord(sha, remoteSha = zeros, localRef = 'refs/heads/main') {
  return `${localRef} ${sha} refs/heads/main ${remoteSha}\n`;
}

describe('Git identity guard', { timeout: 15_000 }, () => {
  it('allows the owner, GitHub web committer, and independent contributors', async () => {
    const repo = await fixture();
    repo.commit();
    repo.commit(
      {
        GIT_AUTHOR_EMAIL: 'another-contributor@example.org',
        GIT_COMMITTER_EMAIL: '12345+contributor@users.noreply.github.com',
      },
      'Collaborative change\n\nCo-authored-by: Teammate <67890+teammate@users.noreply.github.com>',
    );
    expect(repo.check().status).toBe(0);
    expect(repo.check(['--current']).status).toBe(0);
  });

  it.each(['AUTHOR', 'COMMITTER'])('rejects a bad historical %s independently', async (role) => {
    const repo = await fixture();
    const sha = repo.commit({ [`GIT_${role}_EMAIL`]: rejectedEmail });
    const result = repo.check(['--history']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${sha} ${role.toLowerCase()}: ${rejectedEmail}`);
  });

  it.each(['AUTHOR', 'COMMITTER'])(
    'checks effective upcoming %s environment overrides',
    async (role) => {
      const repo = await fixture();
      const result = repo.check(['--current'], {
        env: { [`GIT_${role}_EMAIL`]: rejectedEmail.toUpperCase() },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`Current ${role.toLowerCase()}`);
    },
  );

  it('uses current Git configuration when identity overrides are absent', async () => {
    const repo = await fixture();
    repo.git(['config', 'user.name', 'Configured contributor']);
    repo.git(['config', 'user.email', rejectedEmail]);
    const result = repo.check(['--current'], {
      env: { GIT_AUTHOR_EMAIL: undefined, GIT_COMMITTER_EMAIL: undefined },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Current author');
    expect(result.stderr).toContain('Current committer');
  });

  it('finds co-author trailers without treating addresses in prose as attribution', async () => {
    const repo = await fixture();
    repo.commit({}, `Document the rejected address ${rejectedEmail}`);
    expect(repo.check().status).toBe(0);
    const sha = repo.commit(
      {},
      `Collaborative change\n\nCo-authored-by: Valid <valid@example.org>\ncO-aUtHoReD-bY: Other <${rejectedEmail}>`,
    );
    const result = repo.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${sha} Co-authored-by: ${rejectedEmail}`);
  });

  it('audits raw identities even when a mailmap hides the bad author', async () => {
    const repo = await fixture();
    repo.commit({ GIT_AUTHOR_EMAIL: rejectedEmail });
    await writeFile(path.join(repo.cwd, '.mailmap'), `Owner <${ownerEmail}> <${rejectedEmail}>\n`);
    repo.git(['config', 'log.mailmap', 'true']);
    expect(repo.check().status).toBe(1);
  });

  it.each(['refs/heads/other', 'refs/remotes/origin/other', 'refs/tags/other'])(
    'audits commits reachable only through %s',
    async (ref) => {
      const repo = await fixture();
      const good = repo.commit();
      const bad = repo.commit({ GIT_AUTHOR_EMAIL: rejectedEmail });
      repo.git(['update-ref', ref, bad]);
      repo.git(['reset', '--hard', good]);
      expect(repo.check().status).toBe(1);
      repo.git(['update-ref', '-d', ref]);
      expect(repo.check().status).toBe(0);
    },
  );

  it('ignores reflog-only commits and unrelated reference namespaces', async () => {
    const repo = await fixture();
    const good = repo.commit();
    const bad = repo.commit({ GIT_AUTHOR_EMAIL: rejectedEmail });
    repo.git(['update-ref', 'refs/archive/old-identity', bad]);
    repo.git(['reset', '--hard', good]);
    expect(repo.check().status).toBe(0);
  });

  it('checks all pushed ancestry, including commits already on the remote', async () => {
    const repo = await fixture();
    const bad = repo.commit({ GIT_COMMITTER_EMAIL: rejectedEmail });
    const good = repo.commit();
    const result = repo.check(['--pre-push'], { input: pushRecord(good, bad) });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${bad} committer`);
  });

  it('checks only pushed tips, including annotated tags, and skips deleted refs', async () => {
    const repo = await fixture();
    const good = repo.commit();
    repo.git(['tag', '-a', 'clean-tag', '-m', 'Clean annotated tag']);
    const tag = repo.git(['rev-parse', 'clean-tag']);
    const bad = repo.commit({ GIT_AUTHOR_EMAIL: rejectedEmail });
    repo.git(['branch', 'unrelated-bad', bad]);
    const result = repo.check(['--pre-push'], {
      input: pushRecord(tag, zeros, 'refs/tags/clean-tag') + pushRecord(zeros, bad, '(delete)'),
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 commits');
    expect(repo.check(['--pre-push'], { input: pushRecord(good) + pushRecord(bad) }).status).toBe(
      1,
    );
  });

  it('allows unborn history, an empty push, and deletion-only pushes', async () => {
    const repo = await fixture();
    expect(repo.check().status).toBe(0);
    expect(repo.check(['--pre-push']).status).toBe(0);
    expect(repo.check(['--pre-push'], { input: pushRecord(zeros) }).status).toBe(0);
  });

  it.skipIf(process.platform === 'win32')(
    'hook wrappers preserve stdin and handle repository paths containing spaces',
    async () => {
      const repo = await fixture();
      await mkdir(path.join(repo.cwd, 'scripts'));
      await copyFile(script, path.join(repo.cwd, 'scripts/check-git-identities.mjs'));
      const good = repo.commit();
      const bad = repo.commit({ GIT_AUTHOR_EMAIL: rejectedEmail });
      expect(repo.hook('pre-commit').status).toBe(0);
      expect(repo.hook('pre-commit', { env: { GIT_COMMITTER_EMAIL: rejectedEmail } }).status).toBe(
        1,
      );
      expect(repo.hook('pre-push', { input: pushRecord(good) }).status).toBe(0);
      expect(repo.hook('pre-push', { input: pushRecord(bad) }).status).toBe(1);
    },
  );

  it('fails closed for malformed input, unknown tips, and invalid CLI options', async () => {
    const repo = await fixture();
    expect(repo.check(['--pre-push'], { input: 'missing fields' }).status).toBe(1);
    expect(repo.check(['--pre-push'], { input: pushRecord('a'.repeat(40)) }).status).toBe(1);
    expect(repo.check(['--unknown']).status).toBe(1);
    expect(repo.check(['--history', '--current']).status).toBe(1);
    expect(repo.check(['--help']).status).toBe(0);
  });
});
