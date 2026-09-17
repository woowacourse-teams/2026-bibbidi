interface PreparationRoadmapStateProps {
  onRetry?: () => void;
  status: "authentication-required" | "loading" | "empty" | "error";
}

export function PreparationRoadmapState({
  onRetry,
  status,
}: PreparationRoadmapStateProps) {
  if (status === "loading") {
    return (
      <div className="preparation-roadmap-state" role="status">
        준비 목록을 불러오고 있어요.
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="preparation-roadmap-state" role="status">
        표시할 준비 목록이 없어요.
      </div>
    );
  }

  if (status === "authentication-required") {
    return (
      <div className="preparation-roadmap-state" role="alert">
        <p>로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.</p>
        <button onClick={onRetry} type="button">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="preparation-roadmap-state" role="alert">
      <p>준비 목록을 불러오지 못했어요.</p>
      <button onClick={onRetry} type="button">
        다시 시도
      </button>
    </div>
  );
}
