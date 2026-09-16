import {
  ChecklistCategoryViewModel,
  ChecklistAppointmentViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistTaskCategoryEditor } from "./ChecklistTaskCategoryEditor";
import "./ChecklistTaskDetailContent.css";

interface ChecklistTaskDetailContentProps {
  categories: ChecklistCategoryViewModel[];
  categoryTitle: string;
  editing?: ChecklistItemEditingController;
  task: ChecklistTaskViewModel;
}

function ChecklistAppointment({
  appointment,
}: {
  appointment: ChecklistAppointmentViewModel;
}) {
  return (
    <li className="checklist-detail-content__appointment">
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
      </span>

      <span
        aria-label={appointment.isDone ? "완료된 일정" : "미완료 일정"}
        className={`checklist-detail-content__appointment-status${
          appointment.isDone
            ? " checklist-detail-content__appointment-status--complete"
            : ""
        }`}
      >
        {appointment.isDone ? "✓" : ""}
      </span>
    </li>
  );
}

export function ChecklistTaskDetailContent({
  categories,
  categoryTitle,
  editing,
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
              <span
                className={`checklist-detail-content__task-status checklist-detail-content__task-status--${task.status}`}
              >
                {task.statusLabel}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby={`${task.id}-appointments-title`}>
        <h3 id={`${task.id}-appointments-title`}>
          일정 {task.appointments.length}개
        </h3>
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
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
