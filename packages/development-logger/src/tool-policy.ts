import { isAbsolute, relative, resolve } from 'node:path';
import { splitShell, tokens, writesFile } from './shell.ts';
import { commandFromToolInput, validationForCommand } from './validation.ts';
import type { HookOutput, LoggerConfig, ShellSegment, ToolInput } from './types.ts';

type PolicyConfig = Pick<LoggerConfig, 'validation'>;

const MUTATING_TOOL_NAMES = /(apply.?patch|write|edit|delete|remove|move|create|notebook)/i;
const SHELL_TOOL_NAMES = /(bash|shell|exec|command|terminal|powershell)/i;
const PATH_KEYS = ['file_path', 'filePath', 'notebook_path', 'notebookPath', 'path', 'target_file'];

/** 루프나 조건문의 머리는 그 자체로 부작용이 없다. 안쪽 명령은 별도 세그먼트로 따로 판정된다. */
const LOOP_HEADERS = /^(?:for|while|until|case)\b/i;
const LEADING_KEYWORDS = /^(?:if|elif|then|else|do|done|fi|esac|\{|\})\b\s*/i;
const XARGS_VALUE_FLAGS = new Set([
  '-n', '-I', '-i', '-P', '-L', '-d', '-E', '-s',
  '--max-args', '--replace', '--max-procs', '--max-lines', '--delimiter', '--eof', '--max-chars',
]);

const READ_ONLY_PATTERNS = [
  /^cd(?:\s|$)/i,
  /^pwd$/i,
  /^(?:git\s+)?(?:status|diff|log|show|rev-parse|ls-files)\b/i,
  /^git\s+(?:merge-base|blame|grep|branch\s+--show-current|worktree\s+list)\b/i,
  /^git\s+(?:ls-tree|cat-file|show-ref|for-each-ref|rev-list|describe|shortlog|count-objects)\b/i,
  /^git\s+remote(?:\s+(?:-v|--verbose|show|get-url)\b.*)?$/i,
  /^(?:rg|grep|ls|dir|cat|head|tail|wc|which|echo|jq|sort|uniq|cut|tr|column|nl|file|stat|du|tree|basename|dirname|realpath|date|type|get-content|get-childitem|select-string)\b/i,
  /^(?:awk|printf|seq|comm|paste|rev|tac|md5sum|sha1sum|sha256sum|cksum|expand|unexpand|fold|join)\b/i,
  /^diff\b/i,
  /^\[{1,2}\s/,
  /^test\s+-[a-z]\b/i,
  /^sed\b(?!.*\s-i)/i,
  /^find\b(?!.*\s-(?:delete|exec|execdir|ok|okdir)\b)/i,
  /^gh\s+(?:issue|pr)\s+(?:view|list|diff|checks|status)\b/i,
  /^gh\s+repo\s+view\b/i,
  /^gh\s+api\s+(?!.*(?:--method|-X)[\s=]*(?:POST|PUT|PATCH|DELETE))(?!.*\s(?:-f|-F|--field|--raw-field|--input)(?:\s|=))/i,
  /^node\s+(?:--[\w-]+(?:=\S+)?\s+)*--test\b/i,
  /^npm\s+(?:test|run\s+(?:test|lint|build|typecheck))\b/i,
  /^(?:pnpm|yarn)\s+(?!(?:.*\s)?(?:add|install|i|remove|rm|update|up|upgrade|dlx|create|init|link|unlink|import|patch)(?:\s|$))/i,
  /^(?:\S*[\\/])?gradlew(?:\.bat)?\s(?:.*\s)?(?:test|build|check)\b/i,
];

export function isShellTool(toolName: unknown): boolean {
  return SHELL_TOOL_NAMES.test(String(toolName ?? ''));
}

function segmentsOf(toolInput: ToolInput | undefined): ShellSegment[] {
  return splitShell(commandFromToolInput(toolInput));
}

/** 따옴표 안에 문구가 들어 있기만 한 경우를 실제 실행으로 오인하지 않도록 토큰으로 확인한다. */
function invokes(segment: ShellSegment, words: string[]): boolean {
  const parts = tokens(segment.text).map((part) => part.toLowerCase());
  return words.every((word, index) => parts[index] === word);
}

function isLifecycleCommand(segment: string): boolean {
  return /development-logger[/\\]src[/\\]cli\.(?:mjs|ts)\s+(?:issue|grill|adr|commit|pr)\b/i.test(segment);
}

function isIssueAdrCommand(segment: string, issue: number | undefined): boolean {
  const escaped = String(issue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^gh\\s+issue\\s+(?:edit|comment)\\s+(?:#?${escaped}\\b|.*\\s#?${escaped}\\b)`, 'i').test(segment);
}

/** xargs 뒤에 오는 진짜 명령을 꺼낸다. xargs rm이 통과하면 안 되기 때문이다. */
function commandAfterXargs(text: string): string | null {
  const parts = tokens(text);
  if (!/^xargs$/i.test(parts[0] ?? '')) return null;
  let index = 1;
  while (index < parts.length && (parts[index] as string).startsWith('-')) {
    const flag = parts[index] as string;
    index += 1;
    if (XARGS_VALUE_FLAGS.has(flag) && !flag.includes('=')) index += 1;
  }
  return parts.slice(index).join(' ');
}

function isReadOnlySegment(segment: string): boolean {
  let value = segment.trim();
  if (!value) return true;
  if (LOOP_HEADERS.test(value)) return true;

  let previous: string | null = null;
  while (value && value !== previous) {
    previous = value;
    value = value.replace(LEADING_KEYWORDS, '').trim();
    if (LOOP_HEADERS.test(value)) return true;
  }
  if (!value) return true;

  const inner = commandAfterXargs(value);
  if (inner !== null) return isReadOnlySegment(inner);

  const normalized = value.replace(/^git\s+(?:-C\s+\S+\s+)+/i, 'git ');
  return READ_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isAllowedSegment(segment: string, config: PolicyConfig, issue: number | undefined): boolean {
  return isReadOnlySegment(segment)
    || Boolean(validationForCommand(config, segment))
    || isLifecycleCommand(segment)
    || isIssueAdrCommand(segment, issue);
}

/** 저장소 밖 절대 경로만 건드리는 도구 호출은 이 저장소의 작업이 아니므로 막지 않는다. */
function targetsOutsideRepository(toolInput: ToolInput | undefined, root: string | null): boolean {
  if (!root || !toolInput) return false;
  const targets = PATH_KEYS
    .map((key) => toolInput[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (!targets.length) return false;
  return targets.every((target) => {
    if (!isAbsolute(target)) return false;
    const away = relative(resolve(root), resolve(target));
    return away.startsWith('..') || isAbsolute(away);
  });
}

export function isPullRequestCreate(toolName: unknown, toolInput: ToolInput | undefined): boolean {
  if (!isShellTool(toolName)) return false;
  return segmentsOf(toolInput).some((segment) => invokes(segment, ['gh', 'pr', 'create']));
}

export function isPullRequestCreateByOtherTool(toolName: unknown): boolean {
  const name = String(toolName ?? '');
  if (isShellTool(name)) return false;
  return /pull.?request/i.test(name) && /create/i.test(name);
}

export function isIssueCreate(toolName: unknown, toolInput: ToolInput | undefined): boolean {
  if (!isShellTool(toolName)) return false;
  return segmentsOf(toolInput).some((segment) => invokes(segment, ['gh', 'issue', 'create']));
}

export function isGitCommit(toolName: unknown, toolInput: ToolInput | undefined): boolean {
  if (!isShellTool(toolName)) return false;
  return segmentsOf(toolInput).some(({ text }) => /^git\s+(?:-[Cc]\s+\S+\s+)*commit\b/i.test(text));
}

export function isMutation(
  toolName: unknown,
  toolInput: ToolInput | undefined,
  config: PolicyConfig,
  issue: number | undefined,
  root: string | null = null,
): boolean {
  const name = String(toolName ?? '');
  if (MUTATING_TOOL_NAMES.test(name)) return !targetsOutsideRepository(toolInput, root);
  if (!isShellTool(name)) return false;
  const command = commandFromToolInput(toolInput);
  if (!command) return false;
  return splitShell(command).some(({ text }) => writesFile(text) || !isAllowedSegment(text, config, issue));
}

export function deny(reason: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

export function allow(updatedInput: ToolInput | null = null, additionalContext: string | null = null): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      ...(updatedInput ? { updatedInput } : {}),
      ...(additionalContext ? { additionalContext } : {}),
    },
  };
}
