import type { ReactNode } from "react";
import { Result } from "../../../components/result";
import { Button } from "../../../components/button";
import { Checkbox } from "../../../components/checkbox";
import { IconButton } from "../../../components/icon-button";
import { MoreVerticalIcon } from "../../../components/icons/ActionIcons";
import { Menu } from "../../../components/menu";
import { ListRow } from "../../../components/list-row";

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

function ChecklistPropertyRow({
  label,
  first = false,
  children,
}: {
  label: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <ListRow.Description
      border={first ? "none" : "indented"}
      term={label}
      description={
        <span className="checklist-detail-content__property-value">
          {children}
        </span>
      }
    />
  );
}

function ChecklistAppointment({
  appointment,
  management,
  first,
}: {
  first: boolean;
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
      className={
        appointment.isDone
          ? "checklist-detail-content__appointment--complete"
          : undefined
      }
    >
      <ListRow
        border={first ? "none" : "indented"}
        left={
          <span className="checklist-detail-content__appointment-leading">
            <Checkbox.Circle
              aria-busy={isPending ? true : undefined}
              aria-label={
                management
                  ? appointment.isDone
                    ? `${appointment.title} 일정 미완료로 변경`
                    : `${appointment.title} 일정 완료`
                  : appointment.isDone
                    ? "완료된 일정"
                    : "미완료 일정"
              }
              checked={appointment.isDone}
              disabled={!management || isOperationPending}
              onCheckedChange={(checked) =>
                void management?.changeCompletion(appointment.id, checked)
              }
            />
            <time
              aria-label={appointment.dateLabel}
              className="checklist-detail-content__appointment-date"
              dateTime={appointment.date}
            >
              <span>{appointment.monthLabel}</span>
              <strong>{appointment.dayLabel}</strong>
            </time>
          </span>
        }
        contents={
          <ListRow.Texts
            top={
              <span className="checklist-detail-content__appointment-title">
                {appointment.title}
              </span>
            }
            middle={
              <span className="checklist-detail-content__appointment-meta">
                {appointment.timeLabel} · {appointment.placeLabel}
              </span>
            }
            bottom={
              <>
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
              </>
            }
          />
        }
        right={
          management ? (
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
                  icon={<MoreVerticalIcon />}
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
          ) : null
        }
      />
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
          <ChecklistPropertyRow label="카테고리" first>
            <ChecklistTaskCategoryEditor
              categories={categories}
              categoryTitle={categoryTitle}
              editing={editing}
              task={task}
            />
          </ChecklistPropertyRow>
          <ChecklistPropertyRow label="상태">
            <ChecklistTaskStatusEditor editing={editing} task={task} />
          </ChecklistPropertyRow>
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
          <Result headingLevel={4} title="등록된 일정이 없어요." />
        ) : (
          <ul className="checklist-detail-content__appointments">
            {task.appointments.map((appointment, index) => (
              <ChecklistAppointment
                appointment={appointment}
                first={index === 0}
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
