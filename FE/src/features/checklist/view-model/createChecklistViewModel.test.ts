import { describe, expect, it } from "vitest";

import { ChecklistQueryItemModel } from "../model/checklistQuery";
import { createChecklistViewModel } from "./createChecklistViewModel";

function createItem(
  overrides: Partial<ChecklistQueryItemModel>,
): ChecklistQueryItemModel {
  return {
    appointments: [],
    categoryId: "10",
    checklistItemId: 1,
    sourceCatalogItemId: 101,
    status: "prev",
    title: "할 일",
    ...overrides,
    id: overrides.id ?? "checklist-item-1",
  };
}

function createAppointment(
  id: number,
  date: string,
  overrides: Partial<ChecklistQueryItemModel["appointments"][number]> = {},
) {
  return {
    date,
    endTime: null,
    id,
    isDone: false,
    memo: null,
    place: null,
    startTime: null,
    title: `일정 ${id}`,
    ...overrides,
  };
}

describe("createChecklistViewModel", () => {
  it("로그인 서버 항목은 원본 종류와 무관하게 상태를 수정하고 guest 항목은 읽기 전용이다", () => {
    const [category] = createChecklistViewModel({
      categories: [
        {
          id: "10",
          items: [
            createItem({
              checklistItemId: 1,
              sourceCatalogItemId: 101,
              status: "continue",
            }),
            createItem({
              checklistItemId: null,
              sourceCatalogItemId: 102,
            }),
          ],
          title: "카테고리",
        },
      ],
    });

    expect(category?.tasks[0]).toMatchObject({
      checklistItemStatus: "continue",
      isEditable: false,
      isStatusEditable: true,
    });
    expect(category?.tasks[1]).toMatchObject({
      isEditable: false,
      isStatusEditable: false,
    });
  });

  it("명시적인 API 상태를 일정 유무와 관계없이 화면 상태로 변환한다", () => {
    const [category] = createChecklistViewModel({
      categories: [
        {
          id: "10",
          items: [
            createItem({ checklistItemId: 1, status: "done", title: "완료" }),
            createItem({
              checklistItemId: 2,
              status: "continue",
              title: "진행 중",
            }),
            createItem({
              appointments: [createAppointment(1, "2026-09-15")],
              checklistItemId: 3,
              status: "prev",
              title: "미완료",
            }),
          ],
          title: "카테고리",
        },
      ],
    });

    expect(
      category?.tasks.map(({ status, statusLabel }) => ({
        status,
        statusLabel,
      })),
    ).toEqual([
      { status: "complete", statusLabel: "완료" },
      { status: "in-progress", statusLabel: "진행 중" },
      { status: "incomplete", statusLabel: "미완료" },
    ]);
  });

  it("가장 빠른 일정 날짜를 UTC 변환 없이 M월 D일로 표시한다", () => {
    const [category] = createChecklistViewModel({
      categories: [
        {
          id: "10",
          items: [
            createItem({
              appointments: [
                createAppointment(1, "2026-10-02"),
                createAppointment(2, "2026-09-03"),
                createAppointment(3, "2026-09-03"),
              ],
              checklistItemId: 1,
            }),
            createItem({ checklistItemId: 2 }),
          ],
          title: "카테고리",
        },
      ],
    });

    expect(category?.tasks.map((task) => task.schedule)).toEqual([
      "9월 3일",
      "일정 없음",
    ]);
  });

  it("일정 상세 필드를 서버 순서대로 화면용 값으로 변환한다", () => {
    const [category] = createChecklistViewModel({
      categories: [
        {
          id: "10",
          items: [
            createItem({
              appointments: [
                createAppointment(2, "2026-09-12", {
                  endTime: "2026-09-12T20:30:00",
                  memo: "계약 조건 확인",
                  place: "온라인",
                  startTime: "2026-09-12T19:00:00",
                  title: "계약서 검토",
                }),
                createAppointment(1, "2026-09-08", {
                  isDone: true,
                  title: "계약금 입금",
                }),
              ],
            }),
          ],
          title: "카테고리",
        },
      ],
    });

    expect(category?.tasks[0]?.appointments).toEqual([
      {
        date: "2026-09-12",
        dateLabel: "9월 12일",
        dayLabel: "12일",
        id: 2,
        isDone: false,
        memoLabel: "계약 조건 확인",
        monthLabel: "9월",
        placeLabel: "온라인",
        timeLabel: "오후 7시–오후 8시 30분",
        title: "계약서 검토",
      },
      {
        date: "2026-09-08",
        dateLabel: "9월 8일",
        dayLabel: "8일",
        id: 1,
        isDone: true,
        memoLabel: "메모 없음",
        monthLabel: "9월",
        placeLabel: "장소 없음",
        timeLabel: "시간 없음",
        title: "계약금 입금",
      },
    ]);
  });

  it("전체 카테고리 순서와 항목 순서를 유지하고 진행률을 반올림한다", () => {
    const viewModel = createChecklistViewModel({
      categories: [
        { id: "20", items: [], title: "빈 카테고리" },
        {
          id: "10",
          items: [
            createItem({
              checklistItemId: 3,
              status: "done",
              title: "세 번째",
            }),
            createItem({ checklistItemId: 1, title: "첫 번째" }),
            createItem({ checklistItemId: 2, title: "두 번째" }),
          ],
          title: "항목 카테고리",
        },
      ],
    });

    expect(viewModel.map((category) => category.title)).toEqual([
      "빈 카테고리",
      "항목 카테고리",
    ]);
    expect(viewModel[0]).toMatchObject({
      countLabel: "0개",
      expanded: false,
      progress: 0,
      progressLabel: "0%",
    });
    expect(viewModel[1]?.tasks.map((task) => task.title)).toEqual([
      "세 번째",
      "첫 번째",
      "두 번째",
    ]);
    expect(viewModel[1]).toMatchObject({
      countLabel: "3개",
      expanded: true,
      progress: 33,
      progressLabel: "33%",
    });
  });
});
