import { Button } from "../../../components/button";
import { IconButton } from "../../../components/icon-button";
import { Menu } from "../../../components/menu";

import {
  ChecklistCategoryViewModel,
  ChecklistAppointmentViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import { ChecklistTaskCategoryEditor } from "./ChecklistTaskCategoryEditor";
import { ChecklistTaskStatusEditor } from "./ChecklistTaskStatusEditor";
import "./ChecklistTaskDetailContent.css";

interface ChecklistTaskDetailContentProps {
  categories: ChecklistCategoryViewModel[];
  categoryTitle: string;
  editing?: ChecklistItemEditingController;
  appointmentManagement?: ChecklistAppointmentManagementController;
  onRequestScheduleCreation?: () => void;
  task: ChecklistTaskViewModel;
}

function ChecklistAppointment({
  appointment,
  management,
}: {
  appointment: ChecklistAppointmentViewModel;
  management?: ChecklistAppointmentManagementController;
}) {
  const menuIsOpen = management?.openMenuAppointmentId === appointment.id;
  const feedback = management?.operationFeedback;
  const isOperationPending = feedback?.status === "pending";
  const isPending =
    isOperationPending && feedback.appointmentId === appointment.id;
  const completionError =
    feedback?.status === "error" &&
    feedback.appointmentId === appointment.id &&
    feedback.operation === "completion"
      ? feedback.errorMessage
      : undefined;

  return (
    <li
      className={`checklist-detail-content__appointment${
        appointment.isDone
          ? " checklist-detail-content__appointment--complete"
          : ""
      }`}
    >
      {management ? (
        <button
          aria-busy={isPending ? true : undefined}
          aria-label={
            appointment.isDone
              ? `${appointment.title} 일정 미완료로 변경`
              : `${appointment.title} 일정 완료`
          }
          aria-pressed={appointment.isDone}
          className="checklist-detail-content__appointment-check"
          disabled={isOperationPending}
          onClick={() =>
            void management.changeCompletion(
              appointment.id,
              !appointment.isDone,
            )
          }
          type="button"
        >
          <span aria-hidden="true">{appointment.isDone ? "✓" : ""}</span>
        </button>
      ) : (
        <span
          aria-label={appointment.isDone ? "완료된 일정" : "미완료 일정"}
          className={`checklist-detail-content__appointment-check${
            appointment.isDone
              ? " checklist-detail-content__appointment-check--complete"
              : ""
          }`}
        >
          {appointment.isDone ? "✓" : ""}
        </span>
      )}

      <span className="checklist-detail-content__appointment-main">
        <time
          aria-label={appointment.dateLabel}
          className="checklist-detail-content__appointment-date"
          dateTime={appointment.date}
        >
          <span>{appointment.monthLabel}</span>
          <strong>{appointment.dayLabel}</strong>
        </time>

        <span className="checklist-detail-content__appointment-body">
          <strong className="checklist-detail-content__appointment-title">
            {appointment.title}
          </strong>
          <span className="checklist-detail-content__appointment-meta">
            {appointment.timeLabel} · {appointment.placeLabel}
          </span>
          <span className="checklist-detail-content__appointment-memo">
            {appointment.memoLabel}
          </span>
          {completionError ? (
            <span
              className="checklist-detail-content__appointment-error"
              role="alert"
            >
              {completionError}
            </span>
          ) : null}
        </span>
      </span>

      {management ? (
        <div className="checklist-detail-content__appointment-menu-root">
          <Menu
            aria-label={`${appointment.title} 일정 메뉴`}
            placement="bottom-end"
            width={160}
            open={menuIsOpen}
            onOpenChange={(open) => {
              if (open) management.toggleMenu(appointment.id);
              else management.closeMenu();
            }}
            trigger={
              <IconButton
                icon={
                  <svg
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                }
                iconSize={20}
                aria-label={`${appointment.title} 일정 더보기`}
                disabled={isOperationPending}
                id={`${appointment.id}-appointment-menu-button`}
              />
            }
          >
            <Menu.Item onSelect={() => management.startEditing(appointment)}>
              수정
            </Menu.Item>
            <Menu.Item
              tone="critical"
              onSelect={() => management.requestDelete(appointment.id)}
            >
              삭제
            </Menu.Item>
          </Menu>
        </div>
      ) : null}
    </li>
  );
}

export function ChecklistTaskDetailContent({
  appointmentManagement,
  categories,
  categoryTitle,
  editing,
  onRequestScheduleCreation,
  task,
}: ChecklistTaskDetailContentProps) {
  return (
    <div className="checklist-detail-content">
      <section aria-labelledby={`${task.id}-information-title`}>
        <h3 id={`${task.id}-information-title`}>할 일 정보</h3>
        <dl className="checklist-detail-content__properties">
          <div>
            <dt>카테고리</dt>
            <dd className="checklist-detail-content__category-value">
              <ChecklistTaskCategoryEditor
                categories={categories}
                categoryTitle={categoryTitle}
                editing={editing}
                task={task}
              />
            </dd>
          </div>
          <div>
            <dt>상태</dt>
            <dd>
              <ChecklistTaskStatusEditor editing={editing} task={task} />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby={`${task.id}-appointments-title`}>
        <div className="checklist-detail-content__appointments-header">
          <h3 id={`${task.id}-appointments-title`}>
            일정 {task.appointments.length}개
          </h3>
          {onRequestScheduleCreation ? (
            <Button
              size="small"
              variant="weak"
              id={`${task.id}-add-appointment`}
              onClick={(event) => {
                event.currentTarget.focus();
                onRequestScheduleCreation();
              }}
              type="button"
            >
              <span aria-hidden="true">＋</span>
              일정 추가
            </Button>
          ) : null}
        </div>
        {task.appointments.length === 0 ? (
          <p className="checklist-detail-content__empty">
            등록된 일정이 없어요.
          </p>
        ) : (
          <ul className="checklist-detail-content__appointments">
            {task.appointments.map((appointment) => (
              <ChecklistAppointment
                appointment={appointment}
                key={appointment.id}
                management={appointmentManagement}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
