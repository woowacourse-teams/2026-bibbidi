import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gitDirectory, removeFile, run, tryRun } from './process.mjs';

export function gitMetadata(root) {
  return {
    branch: run('git', ['branch', '--show-current'], { cwd: root }),
    head: run('git', ['rev-parse', 'HEAD'], { cwd: root }),
    status: run('git', ['status', '--short'], { cwd: root }),
  };
}

export function snapshotTree(root) {
  const gitDir = gitDirectory(root);
  const indexPath = join(gitDir, `devlogger-index-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  try {
    const head = tryRun('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root });
    run('git', head.ok ? ['read-tree', 'HEAD'] : ['read-tree', '--empty'], { cwd: root, env });
    run('git', ['add', '-A', '--', '.'], { cwd: root, env });
    tryRun('git', ['rm', '-r', '--cached', '--ignore-unmatch', '--', '.devlog'], { cwd: root, env });
    return run('git', ['write-tree'], { cwd: root, env });
  } finally {
    removeFile(indexPath);
  }
}

export function diffTrees(root, before, after) {
  if (!before || !after || before === after) return '';
  return run('git', ['diff', '--binary', '--full-index', before, after, '--', '.', ':(exclude).devlog', ':(exclude).devlog/**'], { cwd: root });
}

export function diffStat(root, before, after) {
  if (!before || !after || before === after) return '';
  return run('git', ['diff', '--stat', before, after, '--', '.', ':(exclude).devlog', ':(exclude).devlog/**'], { cwd: root });
}

export function changedFiles(root, baseBranch) {
  const mergeBase = run('git', ['merge-base', 'HEAD', baseBranch], { cwd: root });
  const committed = run('git', ['diff', '--name-only', `${mergeBase}..HEAD`], { cwd: root })
    .split(/\r?\n/)
    .filter(Boolean);
  const worktree = run('git', ['status', '--porcelain=v1'], { cwd: root })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, ''));
  return [...new Set([...committed, ...worktree])].filter((path) => !path.startsWith('.devlog/'));
}

export function tracked(root, path) {
  return tryRun('git', ['ls-files', '--error-unmatch', '--', path], { cwd: root }).ok;
}

export function temporaryDirectory(prefix = 'devlogger-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeDirectory(path) {
  rmSync(path, { recursive: true, force: true });
}
