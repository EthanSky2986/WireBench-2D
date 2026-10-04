#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// This address belongs to an unrelated GitHub account. Other contributors,
// including GitHub's noreply@github.com committer, retain their own identities.
const rejectedEmail = 'noreply@users.noreply.github.com';
const usage = `Usage: node scripts/check-git-identities.mjs [--history | --current | --pre-push]
  --history   Audit commits reachable from local branches, remotes and tags (default).
  --current   Check Git's effective author and committer for the next commit.
  --pre-push  Read Git pre-push records from stdin and audit each pushed tip's ancestry.
  --help      Show this help.`;

function git(args) {
  try {
    return execFileSync('git', ['--no-replace-objects', '-c', 'log.showSignature=false', ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(error.stderr?.trim() || error.message);
  }
}

function checkEmail(email, location, violations) {
  if (email.trim().toLowerCase() === rejectedEmail) {
    violations.push(`${location}: ${email}`);
  }
}

function checkCurrent(violations) {
  for (const role of ['AUTHOR', 'COMMITTER']) {
    const identity = git(['var', `GIT_${role}_IDENT`]);
    const email = identity.match(/<([^<>]+)>\s+\d+\s+[+-]\d+\s*$/)?.[1];
    if (!email) throw new Error(`Cannot parse Git's current ${role.toLowerCase()} identity.`);
    checkEmail(email, `Current ${role.toLowerCase()}`, violations);
  }
}

function pushedTips(input) {
  const tips = new Set();
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.trim().split(/\s+/);
    const [, localSha, , remoteSha] = fields;
    if (
      fields.length !== 4 ||
      !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(localSha) ||
      !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(remoteSha)
    ) {
      throw new Error(
        'Invalid pre-push input: expected local-ref local-sha remote-ref remote-sha.',
      );
    }
    if (!/^0+$/.test(localSha)) tips.add(localSha);
  }
  return [...tips];
}

function checkHistory(revisions, violations) {
  // Use raw emails (not mailmap aliases) and Git's trailer parser so mentioning
  // an address in prose does not turn it into a co-author attribution.
  const fields = git([
    'log',
    '-z',
    '--no-use-mailmap',
    '--format=%H%x00%ae%x00%ce%x00%(trailers:key=Co-authored-by,valueonly,unfold,separator=%x1f)',
    ...revisions,
    '--',
  ]).split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % 4 !== 0) throw new Error('Cannot parse Git history.');
  for (let index = 0; index < fields.length; index += 4) {
    const [sha, author, committer, coauthors] = fields.slice(index, index + 4);
    checkEmail(author, `${sha} author`, violations);
    checkEmail(committer, `${sha} committer`, violations);
    for (const coauthor of coauthors.split('\x1f')) {
      const email = coauthor.match(/<([^<>]+)>/)?.[1];
      if (email) checkEmail(email, `${sha} Co-authored-by`, violations);
    }
  }
  return fields.length / 4;
}

try {
  const args = process.argv.slice(2);
  const mode = args[0] ?? '--history';
  if (args.length > 1 || !['--history', '--current', '--pre-push', '--help'].includes(mode)) {
    throw new Error(usage);
  }
  if (mode === '--help') {
    console.log(usage);
  } else {
    const violations = [];
    let summary;
    if (mode === '--current') {
      checkCurrent(violations);
      summary = 'current author and committer';
    } else {
      const revisions =
        mode === '--pre-push'
          ? pushedTips(readFileSync(0, 'utf8'))
          : ['--branches', '--remotes', '--tags'];
      const count = revisions.length ? checkHistory(revisions, violations) : 0;
      summary = `${count} commits`;
    }
    if (violations.length) {
      throw new Error(
        `Known misattributed GitHub email found:\n${violations.join('\n')}\nUse an email associated with your own account.`,
      );
    }
    console.log(`Git identity check passed (${summary}).`);
  }
} catch (error) {
  console.error(`Git identity check failed: ${error.message}`);
  process.exitCode = 1;
}
