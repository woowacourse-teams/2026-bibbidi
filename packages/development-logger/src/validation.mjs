import { snapshotTree } from './git.mjs';

function normalizeCommand(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\.\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function commandFromToolInput(input) {
  if (!input || typeof input !== 'object') return '';
  const value = input.command ?? input.cmd ?? input.script ?? input.code ?? '';
  return Array.isArray(value) ? value.join(' ') : String(value);
}

export function validationForCommand(config, command) {
  const normalized = normalizeCommand(command);
  return config.validation.find((entry) => entry.commands.some((candidate) => normalized.includes(normalizeCommand(candidate)))) ?? null;
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

export function recordValidation(state, config, toolInput, toolResponse, root) {
  const command = commandFromToolInput(toolInput);
  const definition = validationForCommand(config, command);
  if (!definition) return false;
  state.validations ??= {};
  state.validations[definition.key] = {
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

