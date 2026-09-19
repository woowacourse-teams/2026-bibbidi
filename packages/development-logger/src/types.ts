export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  stdio?: Array<'ignore' | 'pipe' | 'inherit'>;
};

export type RunResult =
  | { ok: true; output: string }
  | { ok: false; output: string; error: string; status: number };

export type ValidationDefinition = {
  key: string;
  paths: string[];
  commands: string[];
};

export type LoggerConfig = {
  version: number;
  repository: string;
  defaultBaseBranch: string;
  issueTemplate?: string;
  pullRequestTemplate?: string;
  typeLabels?: Record<string, string>;
  validation: ValidationDefinition[];
};

export type ValidationRecord = {
  command: string;
  passed: boolean;
  tree: string;
  timestamp: string;
};

export type ValidationReason = 'NOT_RUN' | 'FAILED' | 'STALE' | 'PASSED';

export type ValidationStatus = {
  key: string;
  command: string;
  passed: boolean;
  reason: ValidationReason;
};

export type Phase =
  | 'WAITING_FOR_ISSUE'
  | 'RESEARCHING'
  | 'GRILLING'
  | 'GRILL_COMPLETE'
  | 'READY_TO_IMPLEMENT'
  | 'ADR_REOPENED';

export type SessionState = {
  sessionId: string;
  agent: string;
  cwd: string;
  phase: Phase;
  validations: Record<string, ValidationRecord>;
  issue?: number;
  issueRead?: boolean;
  source?: string;
  branch?: string;
  head?: string;
  initialStatus?: string;
  previousTree?: string;
  turnStartTree?: string;
  promptCounter?: number;
  activeTurnKey?: string;
  lastStoppedTurnKey?: string;
  commitConfirmedTree?: string;
  lastDenial?: string;
  bootstrap?: boolean;
  startedAt?: string;
  updatedAt?: string;
};

export type EventType =
  | 'SESSION_STARTED'
  | 'ISSUE_BOUND'
  | 'ISSUE_REBOUND'
  | 'GRILL_ME_STARTED'
  | 'GRILL_ME_QUESTION'
  | 'GRILL_ME_ANSWER'
  | 'GRILL_ME_DECISION'
  | 'GRILL_ME_FINISHED'
  | 'GRILL_ME_SKIPPED'
  | 'ADR_CREATED'
  | 'ADR_REOPENED'
  | 'ADR_CHANGED'
  | 'ADR_SKIPPED'
  | 'USER_PROMPTED'
  | 'TURN_FINISHED'
  | 'TOOL_DENIED'
  | 'COMMIT_EXPLAINED'
  | 'COMMIT_CONFIRMED'
  | 'PR_PLANNED'
  | 'PR_REQUESTED';

export type LogEvent = {
  type: EventType;
  timestamp?: string;
  [field: string]: unknown;
};

export type IssueLabel = string | { name: string };

export type IssueComment = { body: string };

export type IssueData = {
  number: number;
  title: string;
  body: string;
  state: string;
  url?: string;
  comments?: IssueComment[];
  labels?: IssueLabel[];
};

export type IssueService = {
  getIssue: (root: string, repository: string, issue: number) => IssueData;
};

export type ToolInput = Record<string, unknown>;

export type HookEventName = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop';

export type HookPayload = {
  hook_event_name: HookEventName;
  session_id: string;
  cwd?: string;
  source?: string;
  turn_id?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: ToolInput;
  tool_response?: unknown;
};

export type HookOutput = {
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext?: string;
    permissionDecision?: 'allow' | 'deny';
    permissionDecisionReason?: string;
    updatedInput?: ToolInput;
  };
};

export type ShellSegment = {
  text: string;
  next: string | null;
  cwd?: string;
};
