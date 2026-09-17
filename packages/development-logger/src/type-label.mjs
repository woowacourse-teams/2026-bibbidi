import { commandFromToolInput } from './validation.mjs';

export const DEFAULT_TYPE_LABELS = Object.freeze({
  feature: 'type: feature',
  fix: 'type: fix',
  hotfix: 'type: hotfix',
  chore: 'type: chore',
  docs: 'type: docs',
});

function configuredLabels(config) {
  return { ...DEFAULT_TYPE_LABELS, ...(config.typeLabels ?? {}) };
}

function argumentValues(command, longName, shortName = null) {
  const names = shortName ? `(?:--${longName}|-${shortName})` : `--${longName}`;
  const pattern = new RegExp(`(?:^|\\s)${names}(?:=|\\s+)(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, 'gi');
  return [...String(command).matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3]);
}

export function labelsFromToolInput(toolInput) {
  return argumentValues(commandFromToolInput(toolInput), 'label', 'l')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function expectedTypeLabel(branch, config) {
  const prefix = String(branch ?? '').split('/')[0].toLowerCase();
  const label = configuredLabels(config)[prefix];
  if (!label) throw new Error(`브랜치 이름 앞부분(feature, fix 등)으로 type 라벨을 결정할 수 없습니다: ${branch || '(없음)'}`);
  return label;
}

export function validateTypeLabels(labels, config, expected = null) {
  const allowed = Object.values(configuredLabels(config));
  const types = labels.filter((label) => /^type\s*:/i.test(label));
  if (types.length !== 1) throw new Error(`type 라벨을 정확히 하나 붙여야 합니다: ${allowed.join(', ')}`);
  const actual = allowed.find((label) => label.toLowerCase() === types[0].toLowerCase());
  if (!actual) throw new Error(`지원하지 않는 type 라벨입니다: ${types[0]}`);
  if (expected && actual !== expected) throw new Error(`type 라벨이 브랜치 이름과 일치하지 않습니다: 브랜치 기준=${expected}, 붙인 라벨=${actual}`);
  return actual;
}

export function validateIssueCreateInput(toolInput, config) {
  return validateTypeLabels(labelsFromToolInput(toolInput), config);
}

export function issueTypeLabel(issueData, config, expected) {
  const labels = (issueData.labels ?? []).map((label) => typeof label === 'string' ? label : label.name);
  return validateTypeLabels(labels, config, expected);
}

export function appendTypeLabel(toolInput, typeLabel) {
  const key = Object.hasOwn(toolInput, 'command') ? 'command' : Object.hasOwn(toolInput, 'cmd') ? 'cmd' : null;
  if (!key || typeof toolInput[key] !== 'string') throw new Error('명령 문자열을 찾지 못했습니다.');
  return { ...toolInput, [key]: `${toolInput[key]} --label "${typeLabel}"` };
}
