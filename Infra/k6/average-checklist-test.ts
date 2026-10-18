import type { Options } from 'k6/options';
import { AverageRun } from './src/average/average-run.ts';
import { checklistTarget } from './src/average/targets.ts';
import type { SummaryData } from './src/report/summary.ts';
import type { SetupData } from './src/session/session.ts';

// /api/checklists/me 하나의 응답 시간 평균을 잰다.
const run = new AverageRun(checklistTarget);

export const options: Options = run.options();

export function setup(): SetupData {
  return run.setup();
}

export default function (data: SetupData): void {
  run.run(data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return run.summary(data);
}
