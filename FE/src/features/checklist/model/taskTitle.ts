export const CHECKLIST_TASK_TITLE_MAX_LENGTH = 50;

export function validateChecklistTaskTitle(title: string): string | undefined {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length === 0) return "할 일 제목을 입력해 주세요.";
  return normalizedTitle.length > CHECKLIST_TASK_TITLE_MAX_LENGTH
    ? `할 일 제목은 ${CHECKLIST_TASK_TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`
    : undefined;
}
