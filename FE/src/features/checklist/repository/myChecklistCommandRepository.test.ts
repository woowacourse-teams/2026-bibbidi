import { describe, expect, it, vi } from "vitest";

import {
  RemoteMyChecklistCommandDataSource,
  RemoteMyChecklistCreationApiError,
  RemoteMyChecklistCreationNetworkError,
  RemoteMyChecklistCreationRequestAbortedError,
} from "../data-source/remoteMyChecklistCommandDataSource";
import {
  createMyChecklistCommandRepository,
  MyChecklistCreationError,
} from "./myChecklistCommandRepository";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "./myChecklistQueryRepository";

function createDataSource(): RemoteMyChecklistCommandDataSource {
  return { createChecklist: vi.fn().mockResolvedValue(1) };
}

function createQueryRepository(exists = true): MyChecklistQueryRepository {
  return {
    getChecklist: vi.fn().mockResolvedValue({ exists, items: [] }),
    invalidate: vi.fn(),
  };
}

describe("MyChecklistCommandRepository", () => {
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
