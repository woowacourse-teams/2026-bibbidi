import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";
import { CalendarSectionLink } from "./CalendarSectionLink";
import "./CalendarList.css";

const defaultMessages = {
  loading: "추천 할 일을 불러오는 중",
  error: "추천 대상을 확인하지 못했어요.",
  empty: "지금 추가할 추천 항목이 없어요.",
};

export function CalendarRecommendedState({
  status,
  isChecklistLoading = false,
  messages = defaultMessages,
  onRetry,
}: {
  status: "loading" | "error" | "complete";
  isChecklistLoading?: boolean;
  messages?: typeof defaultMessages;
  onRetry: () => void;
}) {
  return (
    <section
      className="calendar-list-section"
      aria-labelledby="calendar-recommended-title"
    >
      <ListHeader
        titleId="calendar-recommended-title"
        title="추천 할 일"
        right={
          <CalendarSectionLink to="/preparation">
            로드맵 전체 보기
          </CalendarSectionLink>
        }
      />
      {status === "loading" || isChecklistLoading ? (
        <ListRow.Loader type="bar" aria-label={messages.loading} />
      ) : status === "error" ? (
        <div className="calendar-list-feedback" role="alert">
          <p>{messages.error}</p>
          <Button size="small" color="dark" variant="weak" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      ) : (
        <p className="calendar-list-empty">{messages.empty}</p>
      )}
    </section>
  );
}
