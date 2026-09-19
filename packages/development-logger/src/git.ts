import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gitDirectory, removeFile, run, tryRun } from './process.ts';

const EXCLUDE_DEVLOG = ['--', '.', ':(exclude).devlog', ':(exclude).devlog/**'];

export type GitMetadata = {
  branch: string;
  head: string;
  status: string;
};

export function gitMetadata(root: string): GitMetadata {
  return {
    branch: run('git', ['branch', '--show-current'], { cwd: root }),
    head: run('git', ['rev-parse', 'HEAD'], { cwd: root }),
    status: run('git', ['status', '--short'], { cwd: root }),
  };
}

export function snapshotTree(root: string): string {
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

export function diffTrees(root: string, before: string | null, after: string | null): string {
  if (!before || !after || before === after) return '';
  return run('git', ['diff', '--binary', '--full-index', before, after, ...EXCLUDE_DEVLOG], { cwd: root });
}

export function diffStat(root: string, before: string | null, after: string | null): string {
  if (!before || !after || before === after) return '';
  return run('git', ['diff', '--stat', before, after, ...EXCLUDE_DEVLOG], { cwd: root });
}

export function headTree(root: string): string | null {
  const result = tryRun('git', ['rev-parse', '--verify', 'HEAD^{tree}'], { cwd: root });
  return result.ok ? result.output : null;
}

export function hasCodeChanges(root: string, tree: string): boolean {
  const head = headTree(root);
  if (!head) return true;
  return Boolean(run('git', ['diff', '--name-only', head, tree, ...EXCLUDE_DEVLOG], { cwd: root }));
}

export function changedFiles(root: string, baseBranch: string): string[] {
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

export function tracked(root: string, path: string): boolean {
  return tryRun('git', ['ls-files', '--error-unmatch', '--', path], { cwd: root }).ok;
}

export function temporaryDirectory(prefix = 'devlogger-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeDirectory(path: string): void {
  rmSync(path, { recursive: true, force: true });
}
