#!/usr/bin/env node
import { handleHook } from './hook.mjs';
import { runLifecycle } from './lifecycle.mjs';
import { readStdin } from './process.mjs';

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'hook') {
    const agent = args[0];
    if (!['codex', 'claude'].includes(agent)) throw new Error('hook Agent는 codex 또는 claude여야 합니다.');
    const payload = await readStdin();
    try {
      const output = handleHook({ agent, payload });
      if (output && Object.keys(output).length) process.stdout.write(JSON.stringify(output));
    } catch (error) {
      if (payload.hook_event_name === 'PreToolUse') {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Development Logger 확인 중 오류: ${error.message}`,
          },
        }));
      } else {
        process.stderr.write(`Development Logger 경고: ${error.message}\n`);
      }
    }
    return;
  }

  const result = runLifecycle([mode, ...args]);
  if (result) process.stdout.write(`${result}\n`);
}

main().catch((error) => {
  process.stderr.write(`Development Logger: ${error.message}\n`);
  process.exitCode = 2;
});
