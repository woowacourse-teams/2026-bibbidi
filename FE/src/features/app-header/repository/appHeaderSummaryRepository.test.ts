import { describe, expect, it, vi } from "vitest";

import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRepository,
  ChecklistQueryRequestAbortedError,
} from "../../checklist";
import {
  AppHeaderAuthenticationRequiredError,
  AppHeaderSummaryLoadError,
  AppHeaderSummaryRequestAbortedError,
  createAppHeaderSummaryRepository,
} from "./appHeaderSummaryRepository";

function createChecklistRepository(): ChecklistQueryRepository {
  return { getChecklist: vi.fn() };
}

describe("AppHeaderSummaryRepository", () => {
  it("공통 체크리스트를 헤더 요약 Model로 변환한다", async () => {
    const checklistRepository = createChecklistRepository();
    vi.mocked(checklistRepository.getChecklist).mockResolvedValue({
      categories: [
        {
          id: "1",
          title: "웨딩홀",
          items: [
            {
              appointments: [],
              categoryId: "1",
              createdAt: "2026-09-23T09:00:00",
              id: "1",
              checklistItemId: 1,
              sourceCatalogItemId: 101,
              status: "done",
              title: "완료 항목",
            },
            {
              appointments: [],
              categoryId: "1",
              createdAt: "2026-09-23T09:01:00",
              id: "2",
              checklistItemId: 2,
              sourceCatalogItemId: 102,
              status: "continue",
              title: "미완료 항목",
            },
            {
              appointments: [],
              categoryId: "1",
              createdAt: "2026-09-23T09:02:00",
              id: "3",
              checklistItemId: 3,
              sourceCatalogItemId: null,
              status: "done",
              title: "직접 작성 항목",
            },
          ],
        },
      ],
    });
    const repository = createAppHeaderSummaryRepository(checklistRepository);

    await expect(repository.getSummary()).resolves.toEqual({
      categories: [
        { id: "1", title: "웨딩홀", completedTaskCount: 2, totalTaskCount: 3 },
      ],
      completedTaskCount: 2,
      totalTaskCount: 3,
    });
    expect(checklistRepository.getChecklist).toHaveBeenCalledWith(
      "authenticated",
      undefined,
    );
  });

  it("카테고리가 없으면 0/0 헤더 Model로 변환한다", async () => {
    const checklistRepository = createChecklistRepository();
    vi.mocked(checklistRepository.getChecklist).mockResolvedValue({
      categories: [],
    });
    const repository = createAppHeaderSummaryRepository(checklistRepository);

    await expect(repository.getSummary()).resolves.toEqual({
      categories: [],
      completedTaskCount: 0,
      totalTaskCount: 0,
    });
  });

  it("공통 인증 오류를 헤더 인증 만료 의미로 변환한다", async () => {
    const checklistRepository = createChecklistRepository();
    vi.mocked(checklistRepository.getChecklist).mockRejectedValue(
      new ChecklistQueryAuthenticationRequiredError(),
    );
    const repository = createAppHeaderSummaryRepository(checklistRepository);

    await expect(repository.getSummary()).rejects.toBeInstanceOf(
      AppHeaderAuthenticationRequiredError,
    );
  });

  it("그 외 오류를 헤더 완료율 조회 실패로 변환한다", async () => {
    const checklistRepository = createChecklistRepository();
    vi.mocked(checklistRepository.getChecklist).mockRejectedValue(
      new Error("failed"),
    );
    const repository = createAppHeaderSummaryRepository(checklistRepository);

    await expect(repository.getSummary()).rejects.toBeInstanceOf(
      AppHeaderSummaryLoadError,
    );
  });

  it("공통 요청 취소를 헤더 요청 취소로 변환한다", async () => {
    const checklistRepository = createChecklistRepository();
    vi.mocked(checklistRepository.getChecklist).mockRejectedValue(
      new ChecklistQueryRequestAbortedError(),
    );
    const repository = createAppHeaderSummaryRepository(checklistRepository);

    await expect(repository.getSummary()).rejects.toBeInstanceOf(
      AppHeaderSummaryRequestAbortedError,
    );
  });
});
