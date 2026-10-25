import type { MouseEventHandler, Ref } from "react";
import { Button } from "../../../components/button";
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
    <header
      className="checklist-header"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
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
      <div className="checklist-header__toolbar">
        <div className="checklist-header__summary">
          <h1>{categoryTitle ?? "체크리스트"}</h1>
          <p>
            {isAuthenticated
              ? `전체 ${taskCount}개 · 완료 ${completedCount}개`
              : "로그인하면 체크리스트가 그대로 저장돼요."}
          </p>
        </div>
        <Button
          className="checklist-header__add-task"
          size="large"
          onClick={onAddTask}
          ref={addTaskButtonRef}
          type="button"
        >
          <span aria-hidden="true">＋</span>할 일 추가
        </Button>
      </div>
    </header>
  );
}
