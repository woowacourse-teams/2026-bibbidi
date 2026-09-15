import {
  ChecklistAppointmentViewModel,
  ChecklistTaskViewModel,
} from "../view-model/createChecklistViewModel";
import "./ChecklistTaskDetailPanel.css";

interface ChecklistTaskDetailPanelProps {
  categoryTitle: string;
  onClose: () => void;
  task: ChecklistTaskViewModel;
}

function ChecklistAppointment({
  appointment,
}: {
  appointment: ChecklistAppointmentViewModel;
}) {
  return (
    <li className="checklist-detail-panel__appointment">
      <time
        aria-label={appointment.dateLabel}
        className="checklist-detail-panel__appointment-date"
        dateTime={appointment.date}
      >
        <span>{appointment.monthLabel}</span>
        <strong>{appointment.dayLabel}</strong>
      </time>

      <span className="checklist-detail-panel__appointment-body">
        <strong className="checklist-detail-panel__appointment-title">
          {appointment.title}
        </strong>
        <span className="checklist-detail-panel__appointment-meta">
          {appointment.timeLabel} · {appointment.placeLabel}
        </span>
        <span className="checklist-detail-panel__appointment-memo">
          {appointment.memoLabel}
        </span>
      </span>

      <span
        aria-label={appointment.isDone ? "완료된 일정" : "미완료 일정"}
        className={`checklist-detail-panel__appointment-status${
          appointment.isDone
            ? " checklist-detail-panel__appointment-status--complete"
            : ""
        }`}
      >
        {appointment.isDone ? "✓" : ""}
      </span>
    </li>
  );
}

export function ChecklistTaskDetailPanel({
  categoryTitle,
  onClose,
  task,
}: ChecklistTaskDetailPanelProps) {
  const titleId = `${task.id}-detail-title`;

  return (
    <aside
      aria-labelledby={titleId}
      className="checklist-detail-panel"
      id="checklist-task-detail-panel"
    >
      <header className="checklist-detail-panel__header">
        <h2 id={titleId}>{task.title}</h2>
        <button
          aria-label="할 일 상세 닫기"
          className="checklist-detail-panel__close"
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="checklist-detail-panel__body">
        <section aria-labelledby={`${task.id}-information-title`}>
          <h3 id={`${task.id}-information-title`}>할 일 정보</h3>
          <dl className="checklist-detail-panel__properties">
            <div>
              <dt>카테고리</dt>
              <dd>{categoryTitle}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>
                <span
                  className={`checklist-detail-panel__task-status checklist-detail-panel__task-status--${task.status}`}
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
            <p className="checklist-detail-panel__empty">
              등록된 일정이 없어요.
            </p>
          ) : (
            <ul className="checklist-detail-panel__appointments">
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
    </aside>
  );
}
