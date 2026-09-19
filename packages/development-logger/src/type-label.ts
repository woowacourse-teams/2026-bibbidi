import { argumentValues } from './shell.ts';
import { commandFromToolInput } from './validation.ts';
import type { IssueData, LoggerConfig, ToolInput } from './types.ts';

export const DEFAULT_TYPE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  feature: 'type: feature',
  fix: 'type: fix',
  hotfix: 'type: hotfix',
  chore: 'type: chore',
  docs: 'type: docs',
});

type LabelConfig = Pick<LoggerConfig, 'typeLabels'>;

function configuredLabels(config: LabelConfig): Record<string, string> {
  return { ...DEFAULT_TYPE_LABELS, ...(config.typeLabels ?? {}) };
}

export function labelsFromToolInput(toolInput: ToolInput): string[] {
  return argumentValues(commandFromToolInput(toolInput), 'label', 'l')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function expectedTypeLabel(branch: string | null, config: LabelConfig): string {
  const prefix = String(branch ?? '').split('/')[0]?.toLowerCase() ?? '';
  const label = configuredLabels(config)[prefix];
  if (!label) throw new Error(`브랜치 이름 앞부분(feature, fix 등)으로 type 라벨을 결정할 수 없습니다: ${branch || '(없음)'}`);
  return label;
}

export function validateTypeLabels(labels: string[], config: LabelConfig, expected: string | null = null): string {
  const allowed = Object.values(configuredLabels(config));
  const types = labels.filter((label) => /^type\s*:/i.test(label));
  if (types.length !== 1) throw new Error(`type 라벨을 정확히 하나 붙여야 합니다: ${allowed.join(', ')}`);
  const given = types[0] as string;
  const actual = allowed.find((label) => label.toLowerCase() === given.toLowerCase());
  if (!actual) throw new Error(`지원하지 않는 type 라벨입니다: ${given}`);
  if (expected && actual !== expected) throw new Error(`type 라벨이 브랜치 이름과 일치하지 않습니다: 브랜치 기준=${expected}, 붙인 라벨=${actual}`);
  return actual;
}

export function validateIssueCreateInput(toolInput: ToolInput, config: LabelConfig): string {
  return validateTypeLabels(labelsFromToolInput(toolInput), config);
}

export function issueTypeLabel(issueData: Pick<IssueData, 'labels'>, config: LabelConfig, expected: string): string {
  const labels = (issueData.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
  return validateTypeLabels(labels, config, expected);
}

export function appendTypeLabel(toolInput: ToolInput, typeLabel: string): ToolInput {
  const key = commandKey(toolInput);
  if (!key) throw new Error('명령 문자열을 찾지 못했습니다.');
  return { ...toolInput, [key]: `${toolInput[key] as string} --label "${typeLabel}"` };
}

export function commandKey(toolInput: ToolInput): 'command' | 'cmd' | null {
  for (const key of ['command', 'cmd'] as const) {
    if (Object.hasOwn(toolInput, key) && typeof toolInput[key] === 'string') return key;
  }
  return null;
}
