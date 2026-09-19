import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const requiredEvents = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];

test('Codex와 Claude가 같은 Lifecycle Hook을 연결한다', () => {
  const codex = JSON.parse(readFileSync(resolve(root, '.codex', 'hooks.json'), 'utf8'));
  const claude = JSON.parse(readFileSync(resolve(root, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(Object.keys(codex.hooks), requiredEvents);
  assert.deepEqual(Object.keys(claude.hooks), requiredEvents);
  for (const event of requiredEvents) {
    assert.match(codex.hooks[event][0].hooks[0].command, /development-logger/);
    assert.match(claude.hooks[event][0].hooks[0].command, /development-logger/);
  }
});
