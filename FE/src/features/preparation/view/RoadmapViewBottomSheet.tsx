import { useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "../../../components/icons/ActionIcons";
import { BottomSheet } from "../../../components/bottom-sheet";
import { IconButton } from "../../../components/icon-button";
import { ListRow } from "../../../components/list-row";
import { usePageScrollContainer } from "../../../shared/scroll/usePageScrollContainer";
import { RoadmapView } from "./RoadmapViewSwitcher";

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
  const [open, setOpen] = useState(true);
  const nextView = useRef<RoadmapView | null>(null);
  const { ref, environment } = usePageScrollContainer();
  const close = () => setOpen(false);
  return (
    <div ref={ref}>
      {
        <BottomSheet
          open={open}
          onClose={close}
          id="roadmap-view-picker"
          scrollContainer={environment?.scrollContainer}
          header={<BottomSheet.Header>보기 선택</BottomSheet.Header>}
          headerActions={
            <IconButton
              aria-label="보기 선택 닫기"
              icon={<CloseIcon />}
              onClick={close}
            />
          }
          onExited={() => {
            if (nextView.current && nextView.current !== view)
              onViewChange(nextView.current);
            else onClose();
          }}
        >
          {options.map((option) => (
            <ListRow
              key={option.view}
              aria-controls="roadmap-view-content"
              aria-pressed={view === option.view}
              selected={view === option.view}
              border="none"
              horizontalPadding="small"
              contents={
                <ListRow.Texts top={option.label} bottom={option.description} />
              }
              right={
                view === option.view ? (
                  <CheckIcon width={20} height={20} />
                ) : undefined
              }
              onClick={() => {
                nextView.current = option.view;
                close();
              }}
            />
          ))}
        </BottomSheet>
      }
    </div>
  );
}
