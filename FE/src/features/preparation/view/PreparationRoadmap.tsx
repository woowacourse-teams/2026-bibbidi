import { useEffect, useRef, useState } from "react";
import { Badge } from "../../../components/badge";
import { ProgressBar } from "../../../components/progress-bar";
import { Button } from "../../../components/button";
import {
  useExitSnapshot,
  useLayerPresence,
} from "../../../shared/modal/useLayerPresence";
import { RoadmapCategoryTabs } from "./RoadmapCategoryTabs";
import { RoadmapStageDetail } from "./RoadmapStageDetail";
import { RoadmapHeader } from "./RoadmapHeader";
import type {
  PreparationRoadmapViewModel,
  RoadmapStage,
} from "../view-model/createPreparationRoadmapViewModel";
import "./PreparationRoadmap.css";

interface PreparationRoadmapProps {
  categoryId: string;
  viewModel: PreparationRoadmapViewModel;
  selectedStepId: string;
  isGuest: boolean;
  onRetryProgress: () => void;
  additionErrorMessage: string | null;
  addingCatalogItemIds: readonly string[];
  onAddAllTasks: () => void;
  onCategorySelect: (id: string) => void;
  onStepSelect: (id: string) => void;
  onTaskAdd: (id: string) => void;
}

function PreparationStepIcon({ src }: { src: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (visible || !imageRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, [visible]);
  return (
    <img
      alt=""
      className="preparation-roadmap__step-icon"
      decoding="async"
      draggable={false}
      width={48}
      height={48}
      ref={imageRef}
      src={visible ? src : undefined}
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

function StageCard({
  stage,
  onOpen,
}: {
  stage: RoadmapStage;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const titleId = `roadmap-stage-${stage.id}`;
  const summaryId = `${titleId}-summary`;
  return (
    <li>
      <article
        className="roadmap-stage-card"
        data-complete={stage.isComplete || undefined}
      >
        <header className="roadmap-stage-card__header">
          <span className="roadmap-stage-card__image" aria-hidden="true">
            {stage.iconUrl ? (
              <PreparationStepIcon key={stage.iconUrl} src={stage.iconUrl} />
            ) : (
              stage.numberLabel
            )}
            {stage.isComplete && (
              <span className="roadmap-stage-card__earned">✓</span>
            )}
          </span>
          <div className="roadmap-stage-card__heading">
            <div className="roadmap-stage-card__eyebrow">
              <span>{stage.numberLabel}</span>
              <Badge color={stage.badgeColor}>{stage.statusLabel}</Badge>
            </div>
            <h2 id={titleId}>{stage.title}</h2>
          </div>
        </header>
        <div id={summaryId} className="roadmap-stage-card__progress">
          <p>{stage.progressLabel}</p>
          {stage.progress !== undefined && (
            <ProgressBar
              progress={stage.progress}
              size="light"
              aria-label={`${stage.title} 내 할 일 완료`}
              aria-valuetext={`${stage.includedCount}개 중 ${stage.completedCount}개 완료`}
              color={
                stage.isComplete ? "var(--color-bg-positive-weak)" : undefined
              }
            />
          )}
        </div>
        {stage.nextTask && (
          <div className="roadmap-stage-card__preview">
            <span className="roadmap-stage-card__preview-label">
              {stage.previewLabel}
            </span>
            <p>{stage.nextTask.title}</p>
          </div>
        )}
        <span className="roadmap-stage-card__footer" aria-hidden="true">
          할 일 {stage.tasks.length}개 보기 <span>→</span>
        </span>
        <button
          type="button"
          className="roadmap-stage-card__trigger"
          aria-describedby={summaryId}
          aria-label={`${stage.numberLabel} ${stage.title}`}
          aria-haspopup="dialog"
          onClick={(event) => onOpen(event.currentTarget)}
        />
      </article>
    </li>
  );
}

export function PreparationRoadmap({
  categoryId,
  viewModel,
  selectedStepId,
  isGuest,
  onRetryProgress,
  additionErrorMessage,
  addingCatalogItemIds,
  onAddAllTasks,
  onCategorySelect,
  onStepSelect,
  onTaskAdd,
}: PreparationRoadmapProps) {
  const [openStage, setOpenStage] = useState<{
    categoryId: string;
    stepId: string;
  } | null>(null);
  const returnFocusRef = useRef<HTMLButtonElement>(null);
  const stage =
    openStage?.categoryId === categoryId && openStage.stepId === selectedStepId
      ? viewModel.stages.find((item) => item.id === openStage.stepId)
      : undefined;
  const detailOpen = stage !== undefined;
  const { present, onExited } = useLayerPresence(detailOpen);
  const displayedStage = useExitSnapshot(detailOpen, stage);
  const pending = addingCatalogItemIds.length > 0;
  const close = () => {
    if (!pending) setOpenStage(null);
  };
  return (
    <div className="preparation-roadmap">
      <RoadmapHeader
        categoryTitle={viewModel.categoryTitle}
        summary={viewModel.summary}
      />
      <div className="preparation-roadmap__body">
        <RoadmapCategoryTabs
          categories={viewModel.categories}
          selectedCategoryId={categoryId}
          controlsId="preparation-roadmap-content"
          onCategorySelect={(id) => {
            setOpenStage(null);
            onCategorySelect(id);
          }}
        />
        <section
          id="preparation-roadmap-content"
          role="tabpanel"
          aria-labelledby={`roadmap-category-${categoryId}`}
          tabIndex={0}
        >
          {viewModel.progressStatus === "error" && (
            <div className="roadmap-progress-error" role="alert">
              <p>내 준비 현황을 불러오지 못했어요.</p>
              <Button size="small" variant="weak" onClick={onRetryProgress}>
                현황 다시 불러오기
              </Button>
            </div>
          )}
          <ol className="preparation-roadmap__steps" aria-label="준비 단계">
            {viewModel.stages.map((item) => (
              <StageCard
                key={item.id}
                stage={item}
                onOpen={(trigger) => {
                  returnFocusRef.current = trigger;
                  setOpenStage({ categoryId, stepId: item.id });
                  onStepSelect(item.id);
                }}
              />
            ))}
          </ol>
        </section>
      </div>
      {present && displayedStage && (
        <RoadmapStageDetail
          stage={displayedStage}
          open={detailOpen}
          onExited={onExited}
          isGuest={isGuest}
          onClose={close}
          pending={pending}
          addingCatalogItemIds={addingCatalogItemIds}
          additionErrorMessage={additionErrorMessage}
          onTaskAdd={onTaskAdd}
          onAddAllTasks={onAddAllTasks}
          returnFocusRef={returnFocusRef}
        />
      )}
    </div>
  );
}
