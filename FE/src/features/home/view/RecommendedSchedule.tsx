import { Link } from "react-router";
import { Badge } from "../../../components/badge";
import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";
import { PlusIcon } from "../../../components/icons/ActionIcons";

import { RecommendedScheduleViewModel } from "../view-model/createRecommendedScheduleViewModel";
import "./RecommendedSchedule.css";

interface RecommendedScheduleProps {
  onAddTask: (catalogItemId: number) => void;
  viewModel: RecommendedScheduleViewModel;
}

export function RecommendedSchedule({
  onAddTask,
  viewModel,
}: RecommendedScheduleProps) {
  return (
    <section
      aria-labelledby="recommended-schedule-title"
      className="calendar-recommendations"
    >
      <ListHeader
        titleId="recommended-schedule-title"
        title={viewModel.title}
        right={<Link to="/preparation">로드맵 전체 보기 ›</Link>}
      />
      <ul>
        {viewModel.items.map((item, index) => (
          <li key={item.catalogItemId}>
            <ListRow
              border={index === 0 ? "none" : "indented"}
              contents={
                <ListRow.Texts
                  top={
                    <span role="heading" aria-level={3}>
                      {item.title}
                    </span>
                  }
                  bottom={
                    <Badge color="dark" size="xsmall">
                      {item.categoryLabel}
                    </Badge>
                  }
                />
              }
              right={
                <Button
                  aria-label={item.addActionLabel}
                  size="small"
                  color="dark"
                  variant="weak"
                  disabled={item.isAddActionDisabled}
                  loading={item.addActionLabel === "추가 중..."}
                  onClick={() => onAddTask(item.catalogItemId)}
                >
                  {item.addActionLabel === "내 할 일에 추가" && (
                    <PlusIcon size={14} />
                  )}
                  {item.addActionLabel === "내 할 일에 추가"
                    ? "추가"
                    : item.addActionLabel}
                </Button>
              }
            />
            {item.additionErrorMessage && (
              <p className="calendar-recommendations__error" role="alert">
                {item.additionErrorMessage}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
