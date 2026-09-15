import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { diffTrees, removeDirectory, snapshotTree, temporaryDirectory } from '../src/git.mjs';
import { run } from '../src/process.mjs';

test('실제 index를 변경하지 않고 untracked 파일을 포함하며 .devlog는 제외한다', () => {
  const root = temporaryDirectory();
  try {
    run('git', ['init'], { cwd: root });
    run('git', ['config', 'user.name', 'Dev Logger Test'], { cwd: root });
    run('git', ['config', 'user.email', 'devlogger@example.com'], { cwd: root });
    writeFileSync(join(root, 'tracked.txt'), 'before\n');
    run('git', ['add', 'tracked.txt'], { cwd: root });
    run('git', ['commit', '-m', 'initial'], { cwd: root });

    const before = snapshotTree(root);
    writeFileSync(join(root, 'tracked.txt'), 'after\n');
    writeFileSync(join(root, 'untracked.txt'), 'new\n');
    mkdirSync(join(root, '.devlog', '1'), { recursive: true });
    writeFileSync(join(root, '.devlog', '1', 'events.jsonl'), '{}\n');
    const after = snapshotTree(root);
    const diff = diffTrees(root, before, after);

    assert.match(diff, /tracked\.txt/);
    assert.match(diff, /untracked\.txt/);
    assert.doesNotMatch(diff, /\.devlog/);
    assert.equal(run('git', ['diff', '--cached', '--name-only'], { cwd: root }), '');
  } finally {
    removeDirectory(root);
  }
});

