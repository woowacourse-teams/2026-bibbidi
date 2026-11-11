interface PreparationRoadmapStateProps {
  onRetry?: () => void;
  status: "loading" | "empty" | "error";
}

export function PreparationRoadmapState({
  onRetry,
  status,
}: PreparationRoadmapStateProps) {
  if (status === "loading") {
    return (
      <div
        className="preparation-roadmap-state"
        data-page-content-state={status}
        role="status"
      >
        로드맵을 불러오고 있어요.
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div
        className="preparation-roadmap-state"
        data-page-content-state={status}
        role="status"
      >
        표시할 로드맵이 없어요.
      </div>
    );
  }

  return (
    <div
      className="preparation-roadmap-state"
      data-page-content-state={status}
      role="alert"
    >
      <p>로드맵을 불러오지 못했어요.</p>
      <button onClick={onRetry} type="button">
        다시 시도
      </button>
    </div>
  );
}
