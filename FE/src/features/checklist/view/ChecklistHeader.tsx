import type { MouseEventHandler, Ref } from "react";
import { Button } from "../../../components/button";
import { PageHeader } from "../../../components/page-header";
import { PlusIcon } from "../../../components/icons/ActionIcons";
import { ChevronRight } from "../../../components/icons/Chevron";
import "./ChecklistHeader.css";

interface ChecklistHeaderProps {
  categoryTitle?: string;
  taskCount: number;
  completedCount: number;
  isAuthenticated: boolean;
  hidden: boolean;
  onAddTask: MouseEventHandler<HTMLButtonElement>;
  addTaskButtonRef: Ref<HTMLButtonElement>;
}

export function ChecklistHeader({
  categoryTitle,
  taskCount,
  completedCount,
  isAuthenticated,
  hidden,
  onAddTask,
  addTaskButtonRef,
}: ChecklistHeaderProps) {
  return (
    <PageHeader
      className="checklist-header"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      title={categoryTitle ?? "체크리스트"}
      description={
        isAuthenticated
          ? `전체 ${taskCount}개 · 완료 ${completedCount}개`
          : "로그인하면 체크리스트가 그대로 저장돼요."
      }
      navigation={
        <nav aria-label="현재 위치" className="checklist-header__breadcrumb">
          <ol>
            <li>
              <span>체크리스트</span>
            </li>
            {categoryTitle && (
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">{categoryTitle}</span>
              </li>
            )}
          </ol>
        </nav>
      }
      actions={
        <Button
          size="large"
          onClick={onAddTask}
          ref={addTaskButtonRef}
          type="button"
        >
          <PlusIcon size={20} />할 일 추가
        </Button>
      }
    />
  );
}
