import { useLayoutEffect, useRef, type RefObject } from "react";
import { useLinkClickHandler } from "react-router";
import { Dialog } from "../../../components/dialog";
import { BottomSheet } from "../../../components/bottom-sheet";
import { Button } from "../../../components/button";
import { Badge } from "../../../components/badge";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";
import { useIsMobileLayout } from "../../../shared/responsive";
import type { RoadmapStage } from "../view-model/createPreparationRoadmapViewModel";

export function RoadmapStageDetail({
  stage,
  isGuest,
  onClose,
  pending,
  addingCatalogItemIds,
  additionErrorMessage,
  onTaskAdd,
  onAddAllTasks,
  returnFocusRef,
}: {
  stage: RoadmapStage;
  isGuest: boolean;
  onClose: () => void;
  pending: boolean;
  addingCatalogItemIds: readonly string[];
  additionErrorMessage: string | null;
  onTaskAdd: (id: string) => void;
  onAddAllTasks: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const isMobile = useIsMobileLayout();
  const navigate = useLinkClickHandler<HTMLAnchorElement>("/checklist");
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const additionTriggerRef = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (pending) return;
    const trigger = additionTriggerRef.current;
    additionTriggerRef.current = null;
    if (!trigger || trigger.isConnected) return;
    const active = document.activeElement;
    if (active !== document.body && active?.tagName !== "DIALOG") return;
    const next = contentRef.current?.querySelector<HTMLButtonElement>(
      'button[data-roadmap-add]:not(:disabled):not([aria-disabled="true"])',
    );
    (next ?? closeRef.current)?.focus();
  }, [pending, stage.tasks]);
  const title = `${stage.numberLabel} ${stage.title}`;
  const remaining = stage.tasks.filter((task) => !task.isIncluded);
  const content = (
    <div className="roadmap-stage-detail" ref={contentRef}>
      {stage.description && (
        <p className="roadmap-stage-detail__description">{stage.description}</p>
      )}
      <ListHeader
        title="할 일"
        headingLevel={3}
        horizontalPadding="none"
        description={
          <span aria-live="polite">
            전체 {stage.tasks.length}개 · 담은 일 {stage.includedCount}개
          </span>
        }
        right={
          remaining.length > 0 ? (
            <Button
              size="small"
              variant="weak"
              onClick={(event) => {
                additionTriggerRef.current = event.currentTarget;
                onAddAllTasks();
              }}
              aria-disabled={pending}
            >
              모두 추가
            </Button>
          ) : undefined
        }
      />
      {additionErrorMessage && (
        <p role="alert" className="roadmap-stage-detail__error">
          {additionErrorMessage}
        </p>
      )}
      <ul
        className="roadmap-stage-detail__tasks"
        aria-label={`${stage.title}의 할 일`}
      >
        {stage.tasks.map((task, index) => (
          <li key={task.id}>
            <ListRow
              horizontalPadding="none"
              verticalPadding="medium"
              border={index === 0 ? "none" : "indented"}
              contents={
                <ListRow.Texts
                  top={task.title}
                  bottom={task.isEssential ? "필수" : undefined}
                />
              }
              right={
                task.isIncluded ? (
                  <Badge color={task.isComplete ? "positive" : "dark"}>
                    {!isGuest && task.isComplete ? "완료" : "담은 일"}
                  </Badge>
                ) : (
                  <Button
                    size="small"
                    variant="weak"
                    aria-label={`${task.title} 추가${addingCatalogItemIds.includes(task.id) ? " 중" : ""}`}
                    data-roadmap-add
                    onClick={(event) => {
                      additionTriggerRef.current = event.currentTarget;
                      onTaskAdd(task.id);
                    }}
                    aria-disabled={pending}
                    loading={addingCatalogItemIds.includes(task.id)}
                  >
                    추가
                  </Button>
                )
              }
            />
          </li>
        ))}
      </ul>
      {stage.tasks.length === 0 && <p>이 단계에 등록된 할 일이 없어요.</p>}
    </div>
  );
  const checklistLink = (
    <Button.Link
      size="large"
      display="block"
      href="/checklist"
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
        else navigate(event);
      }}
    >
      체크리스트에서 관리
    </Button.Link>
  );
  return isMobile ? (
    <BottomSheet
      open
      aria-label={title}
      header={title}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      closeOnEscape={!pending}
      closeOnDimmerClick={!pending}
      draggable={!pending}
      headerActions={
        <Button
          size="small"
          color="light"
          onClick={onClose}
          disabled={pending}
          aria-label="단계 상세 닫기"
          ref={closeRef}
        >
          닫기
        </Button>
      }
      cta={checklistLink}
    >
      {content}
    </BottomSheet>
  ) : (
    <Dialog
      open
      title={<Dialog.Title>{title}</Dialog.Title>}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      closeOnEscape={!pending}
      closeOnDimmerClick={!pending}
      actions={
        <>
          <div>
            <Button
              size="large"
              color="dark"
              variant="weak"
              display="block"
              onClick={onClose}
              ref={closeRef}
              disabled={pending}
            >
              닫기
            </Button>
          </div>
          <div>{checklistLink}</div>
        </>
      }
    >
      {content}
    </Dialog>
  );
}
