import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { redact } from './redaction.mjs';

const EVENT_TYPES = new Set([
  'SESSION_STARTED',
  'ISSUE_BOUND',
  'GRILL_ME_STARTED',
  'GRILL_ME_QUESTION',
  'GRILL_ME_ANSWER',
  'GRILL_ME_DECISION',
  'GRILL_ME_FINISHED',
  'ADR_CREATED',
  'ADR_REOPENED',
  'ADR_CHANGED',
  'ADR_SKIPPED',
  'USER_PROMPTED',
  'TURN_FINISHED',
  'COMMIT_EXPLAINED',
  'COMMIT_CONFIRMED',
  'PR_PLANNED',
  'PR_REQUESTED',
]);

export function eventPath(root, issue) {
  return join(root, '.devlog', String(issue), 'events.jsonl');
}

export function appendEvent(root, issue, event) {
  if (!EVENT_TYPES.has(event.type)) throw new Error(`지원하지 않는 Event Type입니다: ${event.type}`);
  const path = eventPath(root, issue);
  mkdirSync(dirname(path), { recursive: true });
  const normalized = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
  appendFileSync(path, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

export function readEvents(root, issue) {
  try {
    return readFileSync(eventPath(root, issue), 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function redactField(value) {
  const result = redact(value);
  return { text: result.value, redacted: result.redacted };
}

export function hasEvent(events, type) {
  return events.some((event) => event.type === type);
}

export function nextTurnNumber(events) {
  return events.filter((event) => event.type === 'TURN_FINISHED').length + 1;
}
