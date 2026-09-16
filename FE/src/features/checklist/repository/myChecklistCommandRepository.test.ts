import { describe, expect, it, vi } from "vitest";

import {
  RemoteMyChecklistCommandDataSource,
  RemoteChecklistItemChangeApiError,
  RemoteChecklistItemChangeNetworkError,
  RemoteChecklistItemChangeRequestAbortedError,
  RemoteMyChecklistCreationApiError,
  RemoteMyChecklistCreationNetworkError,
  RemoteMyChecklistCreationRequestAbortedError,
} from "../data-source/remoteMyChecklistCommandDataSource";
import {
  ChecklistItemChangeError,
  createMyChecklistCommandRepository,
  MyChecklistCreationError,
} from "./myChecklistCommandRepository";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

function createDataSource(): RemoteMyChecklistCommandDataSource {
  return {
    changeChecklistItemCategory: vi.fn(),
    changeChecklistItemTitle: vi.fn(),
    createChecklist: vi.fn().mockResolvedValue(1),
  };
}

function createQueryRepository(exists = true): MyChecklistQueryRepository {
  return {
    applyAddedItems: vi.fn(),
    applyItemCategoryUpdate: vi.fn().mockReturnValue(true),
    applyItemTitleUpdate: vi.fn().mockReturnValue(true),
    getChecklist: vi.fn().mockResolvedValue({ exists, items: [] }),
    getRevision: vi.fn().mockReturnValue(0),
    invalidate: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  };
}

describe("MyChecklistCommandRepository", () => {
  it("카테고리를 변경하고 성공 응답의 categoryId만 공통 캐시에 반영한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.changeChecklistItemCategory).mockResolvedValue({
      catalogItemId: null,
      categoryId: 3,
      id: 500,
      status: "continue",
      title: "청첩장 문구 정하기",
    });
    const queryRepository = createQueryRepository();
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await repository.changeItemCategory(500, 3);

    expect(dataSource.changeChecklistItemCategory).toHaveBeenCalledWith(
      500,
      3,
      undefined,
    );
    expect(queryRepository.applyItemCategoryUpdate).toHaveBeenCalledWith(
      500,
      3,
    );
    expect(queryRepository.getChecklist).not.toHaveBeenCalled();
  });

  it("양의 정수가 아닌 카테고리 ID는 원격 요청 전에 거부한다", async () => {
    const dataSource = createDataSource();
    const repository = createMyChecklistCommandRepository(
      dataSource,
      createQueryRepository(),
    );

    await expect(repository.changeItemCategory(500, 0)).rejects.toMatchObject({
      reason: "invalid-request",
    });
    expect(dataSource.changeChecklistItemCategory).not.toHaveBeenCalled();
  });

  it.each([
    [305, 404, "category-not-found"],
    [404, 422, "category-not-changeable"],
  ] as const)(
    "카테고리 수정 API 오류를 Feature용 원인으로 변환한다",
    async (errorCode, status, reason) => {
      const dataSource = createDataSource();
      vi.mocked(dataSource.changeChecklistItemCategory).mockRejectedValue(
        new RemoteChecklistItemChangeApiError(
          errorCode,
          status,
          "서버 안내 메시지",
        ),
      );
      const queryRepository = createQueryRepository();
      const repository = createMyChecklistCommandRepository(
        dataSource,
        queryRepository,
      );

      await expect(repository.changeItemCategory(500, 3)).rejects.toMatchObject(
        { message: "서버 안내 메시지", reason },
      );
      expect(queryRepository.applyItemCategoryUpdate).not.toHaveBeenCalled();
    },
  );

  it("제목을 trim해 변경하고 성공 응답의 제목만 공통 캐시에 반영한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.changeChecklistItemTitle).mockResolvedValue({
      catalogItemId: null,
      categoryId: 2,
      id: 500,
      status: "continue",
      title: "청첩장 문구 최종 확정",
    });
    const queryRepository = createQueryRepository();
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await repository.changeItemTitle(500, "  청첩장 문구 최종 확정  ");

    expect(dataSource.changeChecklistItemTitle).toHaveBeenCalledWith(
      500,
      "청첩장 문구 최종 확정",
      undefined,
    );
    expect(queryRepository.applyItemTitleUpdate).toHaveBeenCalledWith(
      500,
      "청첩장 문구 최종 확정",
    );
    expect(queryRepository.getChecklist).not.toHaveBeenCalled();
  });

  it.each(["   ", "가".repeat(51)])(
    "잘못된 제목은 원격 요청 전에 거부한다",
    async (title) => {
      const dataSource = createDataSource();
      const repository = createMyChecklistCommandRepository(
        dataSource,
        createQueryRepository(),
      );

      await expect(
        repository.changeItemTitle(500, title),
      ).rejects.toMatchObject({
        reason: "invalid-request",
      });
      expect(dataSource.changeChecklistItemTitle).not.toHaveBeenCalled();
    },
  );

  it.each([
    [101, 400, "invalid-request"],
    [203, 403, "forbidden"],
    [304, 404, "item-not-found"],
    [405, 422, "title-not-changeable"],
  ] as const)(
    "수정 API 오류를 Feature용 원인과 안전한 메시지로 변환한다",
    async (errorCode, status, reason) => {
      const dataSource = createDataSource();
      vi.mocked(dataSource.changeChecklistItemTitle).mockRejectedValue(
        new RemoteChecklistItemChangeApiError(
          errorCode,
          status,
          "서버 안내 메시지",
        ),
      );
      const queryRepository = createQueryRepository();
      const repository = createMyChecklistCommandRepository(
        dataSource,
        queryRepository,
      );

      const request = repository.changeItemTitle(500, "새 제목");

      await expect(request).rejects.toMatchObject({
        message: "서버 안내 메시지",
        reason,
      });
      expect(queryRepository.applyItemTitleUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    new RemoteChecklistItemChangeApiError(0, 401),
    new RemoteChecklistItemChangeApiError(201, 500),
  ])("수정 API 인증 오류를 공통 인증 오류로 변환한다", async (error) => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.changeChecklistItemTitle).mockRejectedValue(error);
    const repository = createMyChecklistCommandRepository(
      dataSource,
      createQueryRepository(),
    );

    await expect(
      repository.changeItemTitle(500, "새 제목"),
    ).rejects.toBeInstanceOf(MyChecklistAuthenticationRequiredError);
  });

  it("수정 요청 취소를 공통 요청 취소 오류로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.changeChecklistItemTitle).mockRejectedValue(
      new RemoteChecklistItemChangeRequestAbortedError(),
    );
    const repository = createMyChecklistCommandRepository(
      dataSource,
      createQueryRepository(),
    );

    await expect(
      repository.changeItemTitle(500, "새 제목"),
    ).rejects.toBeInstanceOf(MyChecklistRequestAbortedError);
  });

  it("네트워크·계약 오류와 캐시 반영 실패를 일반 수정 오류로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.changeChecklistItemTitle).mockRejectedValueOnce(
      new RemoteChecklistItemChangeNetworkError(),
    );
    const queryRepository = createQueryRepository();
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await expect(
      repository.changeItemTitle(500, "새 제목"),
    ).rejects.toBeInstanceOf(ChecklistItemChangeError);

    vi.mocked(dataSource.changeChecklistItemTitle).mockResolvedValueOnce({
      catalogItemId: null,
      categoryId: 2,
      id: 500,
      status: "prev",
      title: "새 제목",
    });
    vi.mocked(queryRepository.applyItemTitleUpdate).mockReturnValueOnce(false);

    await expect(
      repository.changeItemTitle(500, "새 제목"),
    ).rejects.toBeInstanceOf(ChecklistItemChangeError);
  });

  it("체크리스트가 존재하면 생성하지 않는다", async () => {
    const dataSource = createDataSource();
    const queryRepository = createQueryRepository();
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await expect(repository.ensureChecklist()).resolves.toBeUndefined();
    expect(dataSource.createChecklist).not.toHaveBeenCalled();
  });

  it("체크리스트가 없으면 생성하고 공통 조회 캐시를 무효화한다", async () => {
    const dataSource = createDataSource();
    const queryRepository = createQueryRepository(false);
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await expect(repository.ensureChecklist()).resolves.toBeUndefined();
    expect(dataSource.createChecklist).toHaveBeenCalledOnce();
    expect(queryRepository.invalidate).toHaveBeenCalledOnce();
  });

  it("존재가 확인된 세션에서는 불필요한 조회와 생성을 반복하지 않는다", async () => {
    const dataSource = createDataSource();
    const queryRepository = createQueryRepository();
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await repository.ensureChecklist();
    await repository.ensureChecklist();

    expect(queryRepository.getChecklist).toHaveBeenCalledOnce();
    expect(dataSource.createChecklist).not.toHaveBeenCalled();
  });

  it("생성 충돌은 다른 요청의 생성을 재조회해 확인한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.createChecklist).mockRejectedValue(
      new RemoteMyChecklistCreationApiError(
        402,
        409,
        "이미 체크리스트가 존재합니다.",
      ),
    );
    const queryRepository = createQueryRepository(false);
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce({ exists: false, items: [] })
      .mockResolvedValueOnce({ exists: true, items: [] });
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await expect(repository.ensureChecklist()).resolves.toBeUndefined();
    expect(queryRepository.invalidate).toHaveBeenCalledOnce();
    expect(queryRepository.getChecklist).toHaveBeenCalledTimes(2);
  });

  it("생성 충돌 후에도 체크리스트가 없으면 생성 실패로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.createChecklist).mockRejectedValue(
      new RemoteMyChecklistCreationApiError(
        402,
        409,
        "이미 체크리스트가 존재합니다.",
      ),
    );
    const queryRepository = createQueryRepository(false);
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );

    await expect(repository.ensureChecklist()).rejects.toBeInstanceOf(
      MyChecklistCreationError,
    );
  });

  it.each([
    new RemoteMyChecklistCreationApiError(0, 401),
    new RemoteMyChecklistCreationApiError(201, 500),
  ])(
    "생성 요청의 401 또는 errorCode 201을 인증 오류로 변환한다",
    async (error) => {
      const dataSource = createDataSource();
      vi.mocked(dataSource.createChecklist).mockRejectedValue(error);
      const repository = createMyChecklistCommandRepository(
        dataSource,
        createQueryRepository(false),
      );

      await expect(repository.ensureChecklist()).rejects.toBeInstanceOf(
        MyChecklistAuthenticationRequiredError,
      );
    },
  );

  it("생성 요청 취소를 공통 요청 취소 오류로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.createChecklist).mockRejectedValue(
      new RemoteMyChecklistCreationRequestAbortedError(),
    );
    const repository = createMyChecklistCommandRepository(
      dataSource,
      createQueryRepository(false),
    );

    await expect(repository.ensureChecklist()).rejects.toBeInstanceOf(
      MyChecklistRequestAbortedError,
    );
  });

  it("일반 생성 실패를 공통 생성 오류로 변환한다", async () => {
    const dataSource = createDataSource();
    vi.mocked(dataSource.createChecklist).mockRejectedValue(
      new RemoteMyChecklistCreationNetworkError(),
    );
    const repository = createMyChecklistCommandRepository(
      dataSource,
      createQueryRepository(false),
    );

    await expect(repository.ensureChecklist()).rejects.toBeInstanceOf(
      MyChecklistCreationError,
    );
  });

  it("체크리스트 없음 재조정은 캐시를 비우고 다시 보장한다", async () => {
    const dataSource = createDataSource();
    const queryRepository = createQueryRepository();
    vi.mocked(queryRepository.getChecklist)
      .mockResolvedValueOnce({ exists: true, items: [] })
      .mockResolvedValueOnce({ exists: false, items: [] });
    const repository = createMyChecklistCommandRepository(
      dataSource,
      queryRepository,
    );
    await repository.ensureChecklist();

    await expect(
      repository.reconcileMissingChecklist(),
    ).resolves.toBeUndefined();
    expect(queryRepository.invalidate).toHaveBeenCalledTimes(2);
    expect(dataSource.createChecklist).toHaveBeenCalledOnce();
  });
});
