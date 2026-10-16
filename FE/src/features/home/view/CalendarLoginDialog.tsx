import { Link } from "react-router";

import { ChecklistModalDialog } from "../../checklist/view/ChecklistModalDialog";

export function CalendarLoginDialog({
  onClose,
  loginTo,
}: {
  onClose: () => void;
  loginTo: string;
}) {
  return (
    <ChecklistModalDialog
      title="로그인이 필요해요"
      description={
        "일정을 추가하려면 로그인해 주세요.\n로그인 후 캘린더에서 계속할 수 있어요."
      }
      onEscape={onClose}
      onBackdropPress={onClose}
      actions={
        <>
          <button
            type="button"
            className="checklist-dialog__button"
            onClick={onClose}
          >
            취소
          </button>
          <Link className="calendar-planning__login-action" to={loginTo}>
            로그인
          </Link>
        </>
      }
    />
  );
}
