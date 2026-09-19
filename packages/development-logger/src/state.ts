import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gitDirectory, readJson, writeJsonAtomic } from './process.ts';
import type { SessionState } from './types.ts';

function safeId(value: unknown): string {
  return String(value ?? 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_');
}

export function stateDirectory(root: string): string {
  return join(gitDirectory(root), 'development-logger');
}

export function statePath(root: string, sessionId: string): string {
  return join(stateDirectory(root), 'sessions', `${safeId(sessionId)}.json`);
}

export function loadState(root: string, sessionId: string): SessionState | null {
  return readJson<SessionState>(statePath(root, sessionId), null);
}

export function saveState(root: string, state: SessionState): SessionState {
  state.updatedAt = new Date().toISOString();
  writeJsonAtomic(statePath(root, state.sessionId), state);
  return state;
}

export function resolveState(root: string, sessionId: string | null = null): SessionState {
  if (sessionId) {
    const state = loadState(root, sessionId);
    if (!state) throw new Error(`이 session의 작업 기록 상태를 찾지 못했습니다: ${sessionId}`);
    return state;
  }

  const directory = join(stateDirectory(root), 'sessions');
  if (!existsSync(directory)) throw new Error('진행 중인 Development Logger 작업이 없습니다.');
  const states = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson<SessionState>(join(directory, name)))
    .filter((state): state is SessionState => Boolean(state))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  const latest = states[0];
  if (!latest) throw new Error('진행 중인 Development Logger 작업이 없습니다.');
  return latest;
}
