import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";
import { PlusIcon } from "../../../components/icons/ActionIcons";

import { RecommendedScheduleViewModel } from "../view-model/createRecommendedScheduleViewModel";
import { CalendarSectionLink } from "./CalendarSectionLink";
import "./CalendarList.css";

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
      className="calendar-list-section"
    >
      <ListHeader
        titleId="recommended-schedule-title"
        title={viewModel.title}
        right={
          <CalendarSectionLink to="/preparation">
            로드맵 전체 보기
          </CalendarSectionLink>
        }
      />
      <ul className="calendar-list-items">
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
                  bottom={item.categoryLabel}
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
                    <PlusIcon size={16} />
                  )}
                  {item.addActionLabel === "내 할 일에 추가"
                    ? "추가"
                    : item.addActionLabel}
                </Button>
              }
            />
            {item.additionErrorMessage && (
              <p className="calendar-list-error" role="alert">
                {item.additionErrorMessage}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
