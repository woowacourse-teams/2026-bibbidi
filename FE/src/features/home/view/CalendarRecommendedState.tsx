import { Link } from "react-router";

export function CalendarRecommendedState({
  status,
  isChecklistLoading,
  onRetry,
}: {
  status: "loading" | "error" | "complete";
  isChecklistLoading: boolean;
  onRetry: () => void;
}) {
  return (
    <section
      className="calendar-planning__card"
      aria-labelledby="calendar-recommended-title"
    >
      <header>
        <h2 id="calendar-recommended-title">추천 할 일</h2>
        <Link to="/preparation">로드맵 전체 보기 ›</Link>
      </header>
      {status === "loading" || isChecklistLoading ? (
        <div className="calendar-planning__skeleton">
          <p role="status">추천 할 일을 불러오는 중</p>
        </div>
      ) : status === "error" ? (
        <p role="alert">
          추천 대상을 확인하지 못했어요.{" "}
          <button type="button" onClick={onRetry}>
            다시 시도
          </button>
        </p>
      ) : (
        <p>지금 추가할 추천 항목이 없어요.</p>
      )}
    </section>
  );
}
