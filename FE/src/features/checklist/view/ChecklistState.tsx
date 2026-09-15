import "./ChecklistState.css";

interface ChecklistStateProps {
  onRetry?: () => void;
  status: "authentication-required" | "empty" | "error" | "loading";
}

export function ChecklistState({ onRetry, status }: ChecklistStateProps) {
  if (status === "loading") {
    return (
      <div className="checklist-state" role="status">
        체크리스트를 불러오고 있어요.
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="checklist-state" role="status">
        표시할 체크리스트가 없어요.
      </div>
    );
  }

  if (status === "authentication-required") {
    return (
      <div className="checklist-state" role="alert">
        <p>로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.</p>
        <button onClick={onRetry} type="button">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="checklist-state" role="alert">
      <p>체크리스트를 불러오지 못했어요.</p>
      <button onClick={onRetry} type="button">
        다시 시도
      </button>
    </div>
  );
}
