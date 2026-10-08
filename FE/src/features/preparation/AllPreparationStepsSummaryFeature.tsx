import { useAuth } from "../auth";
import { getChecklistCategoryItems } from "../checklist/model/checklistQuery";
import { useRoadmapChecklist } from "./hooks/useRoadmapChecklist";

export function AllPreparationStepsSummaryFeature({
  categoryId,
  stepCount,
  guestTaskCount,
}: {
  categoryId: string;
  stepCount: number;
  guestTaskCount: number;
}) {
  const { authState } = useAuth();
  const isGuest = authState.status === "guest";
  const { request } = useRoadmapChecklist(!isGuest);
  const category =
    request.status === "success"
      ? request.checklist.categories.find((item) => item.id === categoryId)
      : undefined;
  const items = category ? getChecklistCategoryItems(category) : [];
  return (
    <>
      {stepCount}개 단계 ·{" "}
      {isGuest
        ? `내 할 일 ${guestTaskCount}개 · 완료 0개`
        : category
          ? `내 할 일 ${items.length}개 · 완료 ${items.filter((item) => item.status === "done").length}개`
          : request.status === "loading"
            ? "준비 현황 확인 중"
            : "내 할 일 현황을 불러오지 못했어요."}
    </>
  );
}
