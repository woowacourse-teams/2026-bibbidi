import { createPortal } from "react-dom";
import { BottomSheet } from "../../../shared/bottom-sheet/BottomSheet";
import { RoadmapView } from "./RoadmapViewSwitcher";
import "./RoadmapViewBottomSheet.css";

const options: { view: RoadmapView; label: string; description: string }[] = [
  {
    view: "personal",
    label: "내 로드맵",
    description: "내가 저장한 할 일을 관리해요.",
  },
  {
    view: "all",
    label: "전체 단계",
    description: "기본 준비 단계와 할 일을 확인해요.",
  },
];

export function RoadmapViewBottomSheet({
  view,
  onClose,
  onViewChange,
}: {
  view: RoadmapView;
  onClose: () => void;
  onViewChange: (view: RoadmapView) => void;
}) {
  return createPortal(
    <BottomSheet
      className="roadmap-view-picker"
      closeLabel="보기 선택 닫기"
      id="roadmap-view-picker"
      onClose={onClose}
      showCloseButton
      title="보기 선택"
      titleId="roadmap-view-picker-title"
    >
      {(requestClose) => (
        <div className="roadmap-view-picker__options">
          {options.map((option) => (
            <button
              aria-controls="roadmap-view-content"
              aria-pressed={view === option.view}
              key={option.view}
              onClick={() => {
                if (view === option.view) requestClose();
                else onViewChange(option.view);
              }}
              type="button"
            >
              <span>
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </span>
              {view === option.view ? (
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="m2 8 4 4 8-8" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </BottomSheet>,
    document.body,
  );
}
