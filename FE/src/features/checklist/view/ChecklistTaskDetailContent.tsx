import { KeyboardEvent, useEffect, useRef } from "react";

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
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const editItemRef = useRef<HTMLButtonElement>(null);
  const deleteItemRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  const managementRef = useRef(management);
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

  useEffect(() => {
    managementRef.current = management;
  }, [management]);

  useEffect(() => {
    if (!menuIsOpen) {
      if (shouldRestoreFocusRef.current) {
        shouldRestoreFocusRef.current = false;
        triggerRef.current?.focus();
      }
      return;
    }

    editItemRef.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        event.target !== triggerRef.current
      ) {
        shouldRestoreFocusRef.current = true;
        managementRef.current?.closeMenu();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuIsOpen]);

  const closeMenu = () => {
    shouldRestoreFocusRef.current = true;
    management?.closeMenu();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }

    const items = [editItemRef.current, deleteItemRef.current].filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") {
      nextIndex = (Math.max(0, currentIndex) + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex <= 0 ? items.length : currentIndex) - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  };

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
        <span className="checklist-detail-content__appointment-menu-root">
          <button
            aria-controls={`${appointment.id}-appointment-menu`}
            aria-expanded={menuIsOpen}
            aria-haspopup="menu"
            aria-label={`${appointment.title} 일정 더보기`}
            className="checklist-detail-content__appointment-more"
            disabled={isOperationPending}
            id={`${appointment.id}-appointment-menu-button`}
            onClick={() => management.toggleMenu(appointment.id)}
            ref={triggerRef}
            type="button"
          >
            <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
          {menuIsOpen ? (
            <div
              className="checklist-detail-content__appointment-menu"
              id={`${appointment.id}-appointment-menu`}
              onKeyDown={handleMenuKeyDown}
              ref={menuRef}
              role="menu"
              tabIndex={-1}
            >
              <button
                onClick={() => {
                  shouldRestoreFocusRef.current = false;
                  management.startEditing(appointment);
                }}
                ref={editItemRef}
                role="menuitem"
                type="button"
              >
                수정
              </button>
              <button
                className="checklist-detail-content__appointment-menu-delete"
                onClick={() => {
                  shouldRestoreFocusRef.current = false;
                  management.requestDelete(appointment.id);
                }}
                ref={deleteItemRef}
                role="menuitem"
                type="button"
              >
                삭제
              </button>
            </div>
          ) : null}
        </span>
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
            <button
              className="checklist-detail-content__add-appointment"
              id={`${task.id}-add-appointment`}
              onClick={(event) => {
                event.currentTarget.focus();
                onRequestScheduleCreation();
              }}
              type="button"
            >
              <span aria-hidden="true">＋</span>
              일정 추가
            </button>
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
