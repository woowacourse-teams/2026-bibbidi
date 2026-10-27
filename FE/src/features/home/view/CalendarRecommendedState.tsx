import { Link } from "react-router";
import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";

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
      <ListHeader
        titleId="calendar-recommended-title"
        title="추천 할 일"
        right={<Link to="/preparation">로드맵 전체 보기 ›</Link>}
      />
      {status === "loading" || isChecklistLoading ? (
        <ListRow.Loader type="bar" aria-label="추천 할 일을 불러오는 중" />
      ) : status === "error" ? (
        <div className="calendar-planning__feedback" role="alert">
          <p>추천 대상을 확인하지 못했어요.</p>
          <Button size="small" color="dark" variant="weak" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      ) : (
        <p>지금 추가할 추천 항목이 없어요.</p>
      )}
    </section>
  );
}
