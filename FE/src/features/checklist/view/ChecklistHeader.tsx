import type { MouseEventHandler, Ref } from "react";
import { Button } from "../../../components/button";
import { PageHeader } from "../../../components/page-header";
import { PlusIcon } from "../../../components/icons/ActionIcons";
import { Breadcrumb } from "../../../components/breadcrumb";
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
        <Breadcrumb
          items={[
            { label: "체크리스트" },
            ...(categoryTitle ? [{ label: categoryTitle }] : []),
          ]}
        />
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
