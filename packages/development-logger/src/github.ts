import { tryRun } from './process.ts';
import type { IssueData } from './types.ts';

export function getIssue(root: string, repository: string, issue: number): IssueData {
  const result = tryRun('gh', [
    'issue',
    'view',
    String(issue),
    '--repo',
    repository,
    '--json',
    'number,title,body,state,comments,url,labels',
  ], { cwd: root });
  if (!result.ok) throw new Error(`GitHub Issue #${issue}를 조회하지 못했습니다: ${result.error || result.output}`);
  return JSON.parse(result.output) as IssueData;
}
