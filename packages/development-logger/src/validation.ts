import { posix } from 'node:path';
import { snapshotTree } from './git.ts';
import { splitShell, tokens, unquote } from './shell.ts';
import type {
  LoggerConfig,
  ValidationRecord,
  ShellSegment,
  ToolInput,
  ValidationDefinition,
  ValidationStatus,
} from './types.ts';

type ValidationConfig = Pick<LoggerConfig, 'validation'>;

type ValidationHolder = { validations?: Record<string, ValidationRecord> };

type FoundValidation = {
  definition: ValidationDefinition;
  waitsForResult: boolean;
};

type GradleInvocation = {
  wrapper: string;
  tasks: string[];
};

function normalizeCommand(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\.\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toPosix(value: unknown): string {
  return String(value ?? '').replace(/\\/g, '/');
}

export function commandFromToolInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const source = input as Record<string, unknown>;
  const value = source.command ?? source.cmd ?? source.script ?? source.code ?? '';
  return Array.isArray(value) ? value.join(' ') : String(value);
}

function changeDirectory(current: string, target: string, root: string | null): string {
  const value = toPosix(unquote(target));
  if (posix.isAbsolute(value) || /^[A-Za-z]:\//.test(value)) {
    const base = root ? toPosix(root) : null;
    if (base && (value === base || value.startsWith(`${base}/`))) return posix.relative(base, value) || '.';
    return value;
  }
  return posix.normalize(posix.join(current, value));
}

/** cd로 옮긴 위치를 따라가며 각 명령이 어느 디렉터리에서 실행되는지 붙여 준다. */
function commandSegments(command: string, root: string | null): ShellSegment[] {
  let cwd = '.';
  const segments: ShellSegment[] = [];
  for (const segment of splitShell(command)) {
    const parts = tokens(segment.text);
    if (/^(?:cd|pushd|set-location)$/i.test(parts[0] ?? '') && parts.length === 2) {
      cwd = changeDirectory(cwd, parts[1] as string, root);
      continue;
    }
    segments.push({ ...segment, cwd });
  }
  return segments;
}

function gradleInvocation(text: string, cwd: string): GradleInvocation | null {
  const parts = tokens(toPosix(text));
  const wrapper = parts[0]?.match(/^(?:\.\/)?(.*?)(gradlew(?:\.bat)?)$/i);
  if (!wrapper) return null;
  let projectDirectory: string | null = null;
  const tasks: string[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index] as string;
    if (part === '-p' || part === '--project-dir') {
      projectDirectory = parts[index + 1] ?? null;
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

function matchesCandidate(segment: ShellSegment, candidate: string): boolean {
  const actual = gradleInvocation(segment.text, segment.cwd ?? '.');
  const expected = gradleInvocation(candidate, '.');
  if (actual || expected) {
    return Boolean(actual && expected && actual.wrapper === expected.wrapper && expected.tasks.every((task) => actual.tasks.includes(task)));
  }
  return normalizeCommand(segment.text).includes(normalizeCommand(candidate));
}

export function findValidation(config: ValidationConfig, command: string, root: string | null = null): FoundValidation | null {
  for (const segment of commandSegments(command, root)) {
    const definition = (config.validation ?? []).find((entry) => entry.commands.some((candidate) => matchesCandidate(segment, candidate)));
    if (definition) return { definition, waitsForResult: segment.next !== '|' && segment.next !== '&' };
  }
  return null;
}

export function validationForCommand(config: ValidationConfig, command: string, root: string | null = null): ValidationDefinition | null {
  return findValidation(config, command, root)?.definition ?? null;
}

export function responseSucceeded(response: unknown): boolean {
  if (response == null) return true;
  if (typeof response === 'string') {
    return !/(?:exit(?:ed)?\s+(?:with\s+)?(?:code\s*)?|exit_code["']?\s*[:=]\s*)[1-9]\d*/i.test(response);
  }
  if (typeof response !== 'object') return true;
  const source = response as Record<string, unknown>;
  const code = source.exit_code ?? source.exitCode ?? source.code ?? source.status;
  if (Number.isInteger(code)) return code === 0;
  if (source.is_error === true || source.isError === true || source.success === false) return false;
  return true;
}

function ranInBackground(toolInput: ToolInput | undefined, toolResponse: unknown): boolean {
  if (toolInput?.run_in_background === true) return true;
  if (!toolResponse || typeof toolResponse !== 'object') return false;
  const source = toolResponse as Record<string, unknown>;
  return Boolean(source.backgroundTaskId || source.background_task_id);
}

export function recordValidation(
  state: ValidationHolder,
  config: ValidationConfig,
  toolInput: ToolInput | undefined,
  toolResponse: unknown,
  root: string,
): boolean {
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

export function requiredValidations(config: ValidationConfig, changedFiles: string[]): ValidationDefinition[] {
  return config.validation.filter((entry) => changedFiles.some((file) => entry.paths.some((prefix) => file === prefix || file.startsWith(prefix))));
}

export function validationStatus(state: ValidationHolder, required: ValidationDefinition[], currentTree: string): ValidationStatus[] {
  return required.map((definition) => {
    const result = state.validations?.[definition.key];
    return {
      key: definition.key,
      command: result?.command ?? definition.commands[0] ?? '',
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
