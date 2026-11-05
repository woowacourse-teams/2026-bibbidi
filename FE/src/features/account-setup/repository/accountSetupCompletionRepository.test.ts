import { describe, expect, it, vi } from "vitest";

import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistModel,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "../../checklist";
import {
  AccountSetupCompletionAuthenticationRequiredError,
  AccountSetupCompletionCheckError,
  AccountSetupCompletionRequestAbortedError,
  createAccountSetupCompletionRepository,
} from "./accountSetupCompletionRepository";

function createChecklist(exists: boolean): MyChecklistModel {
  return { exists, items: [] };
}

function createQueryRepository(): MyChecklistQueryRepository {
  return {
    applyAddedItems: vi.fn(),
    applyAppointmentCompletionUpdate: vi.fn(),
    applyAppointmentRemoval: vi.fn(),
    applyAppointmentUpdate: vi.fn(),
    applyItemCategoryUpdate: vi.fn(),
    applyItemTitleUpdate: vi.fn(),
    getChecklist: vi.fn(),
    getRevision: vi.fn().mockReturnValue(0),
    invalidate: vi.fn(),
    refresh: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  };
}

describe("AccountSetupCompletionRepository", () => {
  it("체크리스트가 있으면 완료 상태와 조회 결과를 반환한다", async () => {
    const queryRepository = createQueryRepository();
    const checklist = createChecklist(true);
    vi.mocked(queryRepository.getChecklist).mockResolvedValue(checklist);
    const repository = createAccountSetupCompletionRepository(queryRepository);

    await expect(repository.getCompletion()).resolves.toEqual({
      status: "complete",
      checklist,
    });
  });

  it("체크리스트가 없으면 계정 설정 필요 상태를 반환한다", async () => {
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist).mockResolvedValue(
      createChecklist(false),
    );
    const repository = createAccountSetupCompletionRepository(queryRepository);

    await expect(repository.getCompletion()).resolves.toEqual({
      status: "required",
    });
  });

  it.each([
    [
      new MyChecklistAuthenticationRequiredError(),
      AccountSetupCompletionAuthenticationRequiredError,
    ],
    [
      new MyChecklistRequestAbortedError(),
      AccountSetupCompletionRequestAbortedError,
    ],
    [new TypeError("network failed"), AccountSetupCompletionCheckError],
  ])(
    "체크리스트 조회 오류를 계정 설정 오류로 변환한다",
    async (error, type) => {
      const queryRepository = createQueryRepository();
      vi.mocked(queryRepository.getChecklist).mockRejectedValue(error);
      const repository =
        createAccountSetupCompletionRepository(queryRepository);

      await expect(repository.getCompletion()).rejects.toBeInstanceOf(type);
    },
  );
});
