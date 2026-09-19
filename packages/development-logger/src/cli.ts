#!/usr/bin/env node
import { handleHook } from './hook.ts';
import { runLifecycle } from './lifecycle.ts';
import { messageOf, readStdin } from './process.ts';
import type { HookPayload } from './types.ts';

const AGENTS = ['codex', 'claude'];

async function runHook(agent: string | undefined): Promise<void> {
  if (!agent || !AGENTS.includes(agent)) throw new Error('hook Agent는 codex 또는 claude여야 합니다.');
  const payload = (await readStdin()) as unknown as HookPayload;
  try {
    const output = handleHook({ agent, payload });
    if (output && Object.keys(output).length) process.stdout.write(JSON.stringify(output));
  } catch (error) {
    // PreToolUse에서 침묵하면 검사 없이 작업이 통과한다. 그래서 오류를 deny로 바꿔 돌려준다.
    if (payload.hook_event_name === 'PreToolUse') {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Development Logger 확인 중 오류: ${messageOf(error)}`,
        },
      }));
    } else {
      process.stderr.write(`Development Logger 경고: ${messageOf(error)}\n`);
    }
  }
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'hook') {
    await runHook(args[0]);
    return;
  }

  const result = runLifecycle([mode ?? '', ...args]);
  if (result) process.stdout.write(`${result}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Development Logger: ${messageOf(error)}\n`);
  process.exitCode = 2;
});
