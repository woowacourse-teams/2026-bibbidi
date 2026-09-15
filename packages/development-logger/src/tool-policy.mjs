import { splitShell, writesFile } from './shell.mjs';
import { commandFromToolInput, validationForCommand } from './validation.mjs';

const MUTATING_TOOL_NAMES = /(apply.?patch|write|edit|delete|remove|move|create|notebook)/i;
const SHELL_TOOL_NAMES = /(bash|shell|exec|command|terminal|powershell)/i;

const READ_ONLY_PATTERNS = [
  /^cd(?:\s|$)/i,
  /^pwd$/i,
  /^(?:git\s+)?(?:status|diff|log|show|rev-parse|ls-files)\b/i,
  /^git\s+(?:merge-base|blame|grep|branch\s+--show-current|worktree\s+list)\b/i,
  /^git\s+remote(?:\s+(?:-v|--verbose|show|get-url)\b.*)?$/i,
  /^(?:rg|grep|ls|dir|cat|head|tail|wc|which|echo|jq|sort|uniq|cut|tr|column|nl|file|stat|du|tree|basename|dirname|realpath|date|type|get-content|get-childitem|select-string)\b/i,
  /^sed\b(?!.*\s-i)/i,
  /^find\b(?!.*\s-(?:delete|exec|execdir|ok|okdir)\b)/i,
  /^gh\s+(?:issue|pr)\s+(?:view|list|diff|checks|status)\b/i,
  /^gh\s+repo\s+view\b/i,
  /^gh\s+api\s+(?!.*(?:--method|-X)[\s=]*(?:POST|PUT|PATCH|DELETE))(?!.*\s(?:-f|-F|--field|--raw-field|--input)(?:\s|=))/i,
  /^node\s+--test\b/i,
  /^npm\s+(?:test|run\s+(?:test|lint|build|typecheck))\b/i,
  /^(?:pnpm|yarn)\s+(?!(?:.*\s)?(?:add|install|i|remove|rm|update|up|upgrade|dlx|create|init|link|unlink|import|patch)(?:\s|$))/i,
  /^(?:\S*[\\/])?gradlew(?:\.bat)?\s(?:.*\s)?(?:test|build|check)\b/i,
];

export function isShellTool(toolName) {
  return SHELL_TOOL_NAMES.test(String(toolName ?? ''));
}

function isLifecycleCommand(segment) {
  return /development-logger[/\\]src[/\\]cli\.mjs\s+(?:grill|adr|commit|pr)\b/i.test(segment);
}

function isIssueAdrCommand(segment, issue) {
  const escaped = String(issue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^gh\\s+issue\\s+(?:edit|comment)\\s+(?:#?${escaped}\\b|.*\\s#?${escaped}\\b)`, 'i').test(segment);
}

function isReadOnlySegment(segment) {
  const value = segment.replace(/^git\s+(?:-C\s+\S+\s+)+/i, 'git ');
  return READ_ONLY_PATTERNS.some((pattern) => pattern.test(value));
}

function isAllowedSegment(segment, config, issue) {
  return isReadOnlySegment(segment)
    || Boolean(validationForCommand(config, segment))
    || isLifecycleCommand(segment)
    || isIssueAdrCommand(segment, issue);
}

export function isPullRequestCreate(toolName, toolInput) {
  if (!isShellTool(toolName)) return false;
  return /\bgh\s+pr\s+create\b/i.test(commandFromToolInput(toolInput));
}

export function isPullRequestCreateByOtherTool(toolName) {
  const name = String(toolName ?? '');
  if (isShellTool(name)) return false;
  return /pull.?request/i.test(name) && /create/i.test(name);
}

export function isIssueCreate(toolName, toolInput) {
  if (!isShellTool(toolName)) return false;
  return /\bgh\s+issue\s+create\b/i.test(commandFromToolInput(toolInput));
}

export function isGitCommit(toolName, toolInput) {
  if (!isShellTool(toolName)) return false;
  return splitShell(commandFromToolInput(toolInput)).some(({ text }) => /^git\s+(?:-[Cc]\s+\S+\s+)*commit\b/i.test(text));
}

export function isMutation(toolName, toolInput, config, issue) {
  const name = String(toolName ?? '');
  if (MUTATING_TOOL_NAMES.test(name)) return true;
  if (!isShellTool(name)) return false;
  const command = commandFromToolInput(toolInput);
  if (!command) return false;
  return splitShell(command).some(({ text }) => writesFile(text) || !isAllowedSegment(text, config, issue));
}

export function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

export function allow(updatedInput = null, additionalContext = null) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      ...(updatedInput ? { updatedInput } : {}),
      ...(additionalContext ? { additionalContext } : {}),
    },
  };
}
