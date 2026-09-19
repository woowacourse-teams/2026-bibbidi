import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { asExecError, gitDirectory } from './process.ts';
import { redact } from './redaction.ts';
import type { EventType, LogEvent } from './types.ts';

const EVENT_TYPES = new Set<EventType>([
  'SESSION_STARTED',
  'ISSUE_BOUND',
  'ISSUE_REBOUND',
  'GRILL_ME_STARTED',
  'GRILL_ME_QUESTION',
  'GRILL_ME_ANSWER',
  'GRILL_ME_DECISION',
  'GRILL_ME_FINISHED',
  'GRILL_ME_SKIPPED',
  'ADR_CREATED',
  'ADR_REOPENED',
  'ADR_CHANGED',
  'ADR_SKIPPED',
  'USER_PROMPTED',
  'TURN_FINISHED',
  'TOOL_DENIED',
  'COMMIT_EXPLAINED',
  'COMMIT_CONFIRMED',
  'PR_PLANNED',
  'PR_REQUESTED',
]);

export type FlushResult = {
  events: number;
  diffs: string[];
};

export function eventPath(root: string, issue: number): string {
  return join(root, '.devlog', String(issue), 'events.jsonl');
}

export function pendingDirectory(root: string, issue: number): string {
  return join(gitDirectory(root), 'development-logger', 'pending', String(issue));
}

/** 임시 디렉터리처럼 Git 저장소가 아닌 곳에서도 읽기는 실패하지 않아야 한다. */
function pendingDirectoryOrNull(root: string, issue: number): string | null {
  try {
    return pendingDirectory(root, issue);
  } catch {
    return null;
  }
}

function pendingEventPath(root: string, issue: number): string | null {
  const directory = pendingDirectoryOrNull(root, issue);
  return directory && join(directory, 'events.jsonl');
}

function readLines(path: string | null): LogEvent[] {
  if (!path) return [];
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogEvent);
  } catch (caught) {
    if (asExecError(caught).code === 'ENOENT') return [];
    throw caught;
  }
}

export function appendEvent(root: string, issue: number, event: LogEvent): LogEvent {
  if (!EVENT_TYPES.has(event.type)) throw new Error(`지원하지 않는 Event Type입니다: ${event.type}`);
  const path = pendingEventPath(root, issue);
  if (!path) throw new Error('작업 기록을 쌓을 Git 디렉터리를 찾지 못했습니다.');
  mkdirSync(dirname(path), { recursive: true });
  const normalized = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
  appendFileSync(path, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

/** 저장소에 커밋된 기록과 아직 내보내지 않은 기록을 시간 순서대로 합쳐 돌려준다. */
export function readEvents(root: string, issue: number): LogEvent[] {
  return [...readLines(eventPath(root, issue)), ...readLines(pendingEventPath(root, issue))];
}

export function discardPending(root: string, issue: number): void {
  const pending = pendingDirectoryOrNull(root, issue);
  if (pending) rmSync(pending, { recursive: true, force: true });
}

/** 쌓아 둔 기록을 .devlog로 옮긴다. 코드와 같은 커밋에 담기게 하는 유일한 지점이다. */
export function flushPending(root: string, issue: number): FlushResult {
  const pending = pendingDirectoryOrNull(root, issue);
  if (!pending || !existsSync(pending)) return { events: 0, diffs: [] };

  const lines = readLines(join(pending, 'events.jsonl'));
  const target = eventPath(root, issue);
  const targetDirectory = dirname(target);
  mkdirSync(targetDirectory, { recursive: true });
  if (lines.length) {
    appendFileSync(target, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8');
  }

  const diffs = readdirSync(pending).filter((name) => name.endsWith('.diff'));
  for (const name of diffs) {
    renameSync(join(pending, name), join(targetDirectory, name));
  }

  rmSync(pending, { recursive: true, force: true });
  return { events: lines.length, diffs };
}

export function redactField(value: unknown): { text: string; redacted: boolean } {
  const result = redact(value);
  return { text: result.value, redacted: result.redacted };
}

export function hasEvent(events: LogEvent[], type: EventType): boolean {
  return events.some((event) => event.type === type);
}

export function nextTurnNumber(events: LogEvent[]): number {
  return events.filter((event) => event.type === 'TURN_FINISHED').length + 1;
}
