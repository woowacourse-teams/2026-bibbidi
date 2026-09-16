import { describe, expect, it, vi } from "vitest";

import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "../../checklist";
import {
  AppHeaderAuthenticationRequiredError,
  AppHeaderSummaryLoadError,
  AppHeaderSummaryRequestAbortedError,
  createAppHeaderSummaryRepository,
} from "./appHeaderSummaryRepository";

function createChecklistRepository(): MyChecklistQueryRepository {
  return {
    applyAddedItems: vi.fn(),
    applyItemCategoryUpdate: vi.fn(),
    applyItemTitleUpdate: vi.fn(),
    getChecklist: vi.fn(),
    getRevision: vi.fn().mockReturnValue(0),
    invalidate: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  };
}

describe("AppHeaderSummaryRepository", () => {
  it("공통 체크리스트를 헤더 요약 Model로 변환한다", async () => {
    const checklistRepository = createChecklistRepository();
    vi.mocked(checklistRepository.getChecklist).mockResolvedValue({
      exists: true,
      items: [
        {
          appointments: [],
          categoryId: 1,
          id: 1,
          isDone: true,
          sourceCatalogItemId: 101,
          title: "완료 항목",
        },
        {
          appointments: [],
          categoryId: 1,
          id: 2,
          isDone: false,
          sourceCatalogItemId: 102,
          title: "미완료 항목",
        },
        {
          appointments: [],
          categoryId: 1,
          id: 3,
          isDone: true,
          sourceCatalogItemId: null,
          title: "직접 작성 항목",
        },
      ],
    });
    const repository = createAppHeaderSummaryRepository(checklistRepository);

    await expect(repository.getSummary()).resolves.toEqual({
      completedTaskCount: 2,
      totalTaskCount: 3,
      weddingDate: { status: "unset" },
    });
    expect(checklistRepository.getChecklist).toHaveBeenCalledWith(undefined);
  });

  it.each([true, false])(
    "빈 체크리스트와 체크리스트 없음 모두 0/0 헤더 Model로 변환한다",
    async (exists) => {
      const checklistRepository = createChecklistRepository();
      vi.mocked(checklistRepository.getChecklist).mockResolvedValue({
        exists,
        items: [],
      });
      const repository = createAppHeaderSummaryRepository(checklistRepository);

      await expect(repository.getSummary()).resolves.toEqual({
        completedTaskCount: 0,
        totalTaskCount: 0,
        weddingDate: { status: "unset" },
      });
    },
  );

  it("공통 인증 오류를 헤더 인증 만료 의미로 변환한다", async () => {
    const checklistRepository = createChecklistRepository();
    vi.mocked(checklistRepository.getChecklist).mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
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
      new MyChecklistRequestAbortedError(),
    );
    const repository = createAppHeaderSummaryRepository(checklistRepository);

    await expect(repository.getSummary()).rejects.toBeInstanceOf(
      AppHeaderSummaryRequestAbortedError,
    );
  });
});
