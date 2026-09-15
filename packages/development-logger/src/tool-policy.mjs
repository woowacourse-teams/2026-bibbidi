import { commandFromToolInput, validationForCommand } from './validation.mjs';

const MUTATING_TOOL_NAMES = /(apply.?patch|write|edit|delete|remove|move|create|notebook)/i;
const SHELL_TOOL_NAMES = /(bash|shell|exec|command|terminal|powershell)/i;

function isLifecycleCommand(command) {
  return /development-logger[/\\]src[/\\]cli\.mjs\s+(?:grill|adr)/i.test(command);
}

function isIssueAdrCommand(command, issue) {
  const escaped = String(issue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bgh\\s+issue\\s+(?:edit|comment)\\s+(?:#?${escaped}\\b|[^;&|]*\\s#?${escaped}\\b)`, 'i').test(command);
}

function isReadOnlyCommand(command) {
  const value = command.trim();
  const patterns = [
    /^(?:git\s+)?(?:status|diff|log|show|rev-parse|ls-files)\b/i,
    /^git\s+(?:status|diff|log|show|rev-parse|ls-files|merge-base|branch\s+--show-current)\b/i,
    /^(?:rg|grep|ls|dir|find|cat|type|get-content|get-childitem)\b/i,
    /^gh\s+issue\s+view\b/i,
    /^gh\s+api\s+(?!.*(?:--method|-X)\s+(?:POST|PUT|PATCH|DELETE))/i,
    /^(?:node\s+--test|npm\s+(?:test|run\s+(?:test|lint|build|typecheck))|pnpm\s+|yarn\s+|\.?[\\/]?gradlew(?:\.bat)?\s+(?:test|build|check))/i,
  ];
  return patterns.some((pattern) => pattern.test(value));
}

export function isPullRequestCreate(toolName, toolInput) {
  if (!SHELL_TOOL_NAMES.test(String(toolName))) return false;
  return /\bgh\s+pr\s+create\b/i.test(commandFromToolInput(toolInput));
}

export function isMutation(toolName, toolInput, config, issue) {
  const name = String(toolName ?? '');
  if (MUTATING_TOOL_NAMES.test(name)) return true;
  if (!SHELL_TOOL_NAMES.test(name)) return false;
  const command = commandFromToolInput(toolInput);
  if (!command) return false;
  if (validationForCommand(config, command)) return false;
  if (isLifecycleCommand(command) || isIssueAdrCommand(command, issue)) return false;
  return !isReadOnlyCommand(command);
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
