import { posix } from 'node:path';
import { snapshotTree } from './git.mjs';
import { splitShell, tokens, unquote } from './shell.mjs';

function normalizeCommand(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\.\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toPosix(value) {
  return String(value ?? '').replace(/\\/g, '/');
}

export function commandFromToolInput(input) {
  if (!input || typeof input !== 'object') return '';
  const value = input.command ?? input.cmd ?? input.script ?? input.code ?? '';
  return Array.isArray(value) ? value.join(' ') : String(value);
}

function changeDirectory(current, target, root) {
  const value = toPosix(unquote(target));
  if (posix.isAbsolute(value) || /^[A-Za-z]:\//.test(value)) {
    const base = root ? toPosix(root) : null;
    if (base && (value === base || value.startsWith(`${base}/`))) return posix.relative(base, value) || '.';
    return value;
  }
  return posix.normalize(posix.join(current, value));
}

function commandSegments(command, root) {
  let cwd = '.';
  const segments = [];
  for (const segment of splitShell(command)) {
    const parts = tokens(segment.text);
    if (/^(?:cd|pushd|set-location)$/i.test(parts[0] ?? '') && parts.length === 2) {
      cwd = changeDirectory(cwd, parts[1], root);
      continue;
    }
    segments.push({ ...segment, cwd });
  }
  return segments;
}

function gradleInvocation(text, cwd) {
  const parts = tokens(toPosix(text));
  const wrapper = parts[0]?.match(/^(?:\.\/)?(.*?)(gradlew(?:\.bat)?)$/i);
  if (!wrapper) return null;
  let projectDirectory = null;
  const tasks = [];
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '-p' || part === '--project-dir') {
      projectDirectory = parts[index + 1];
      index += 1;
    } else if (part.startsWith('--project-dir=')) {
      projectDirectory = part.slice('--project-dir='.length);
    } else if (part === '-x' || part === '--exclude-task') {
      index += 1;
    } else if (!part.startsWith('-')) {
      tasks.push(part.toLowerCase());
    }
  }
  const directory = posix.normalize(posix.join(cwd, projectDirectory ?? (wrapper[1] || '.'))).replace(/\/$/, '');
  const prefix = directory === '.' ? '' : `${directory}/`;
  return { wrapper: `${prefix}${wrapper[2]}`.toLowerCase(), tasks };
}

function matchesCandidate(segment, candidate) {
  const actual = gradleInvocation(segment.text, segment.cwd);
  const expected = gradleInvocation(candidate, '.');
  if (actual || expected) {
    return Boolean(actual && expected && actual.wrapper === expected.wrapper && expected.tasks.every((task) => actual.tasks.includes(task)));
  }
  return normalizeCommand(segment.text).includes(normalizeCommand(candidate));
}

export function findValidation(config, command, root = null) {
  for (const segment of commandSegments(command, root)) {
    const definition = (config.validation ?? []).find((entry) => entry.commands.some((candidate) => matchesCandidate(segment, candidate)));
    if (definition) return { definition, waitsForResult: segment.next !== '|' && segment.next !== '&' };
  }
  return null;
}

export function validationForCommand(config, command, root = null) {
  return findValidation(config, command, root)?.definition ?? null;
}

export function responseSucceeded(response) {
  if (response == null) return true;
  if (typeof response === 'string') {
    return !/(?:exit(?:ed)?\s+(?:with\s+)?(?:code\s*)?|exit_code["']?\s*[:=]\s*)[1-9]\d*/i.test(response);
  }
  if (typeof response !== 'object') return true;
  const code = response.exit_code ?? response.exitCode ?? response.code ?? response.status;
  if (Number.isInteger(code)) return code === 0;
  if (response.is_error === true || response.isError === true || response.success === false) return false;
  return true;
}

function ranInBackground(toolInput, toolResponse) {
  if (toolInput?.run_in_background === true) return true;
  return Boolean(toolResponse && typeof toolResponse === 'object' && (toolResponse.backgroundTaskId || toolResponse.background_task_id));
}

export function recordValidation(state, config, toolInput, toolResponse, root) {
  if (ranInBackground(toolInput, toolResponse)) return false;
  const command = commandFromToolInput(toolInput);
  const found = findValidation(config, command, root);
  if (!found?.waitsForResult) return false;
  state.validations ??= {};
  state.validations[found.definition.key] = {
    command,
    passed: responseSucceeded(toolResponse),
    tree: snapshotTree(root),
    timestamp: new Date().toISOString(),
  };
  return true;
}

export function requiredValidations(config, changedFiles) {
  return config.validation.filter((entry) => changedFiles.some((file) => entry.paths.some((prefix) => file === prefix || file.startsWith(prefix))));
}

export function validationStatus(state, required, currentTree) {
  return required.map((definition) => {
    const result = state.validations?.[definition.key];
    return {
      key: definition.key,
      command: result?.command ?? definition.commands[0],
      passed: result?.passed === true && result.tree === currentTree,
      reason: !result
        ? 'NOT_RUN'
        : result.passed !== true
          ? 'FAILED'
          : result.tree !== currentTree
            ? 'STALE'
            : 'PASSED',
    };
  });
}
