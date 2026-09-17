import { describe, expect, it, vi } from "vitest";

import {
  RemoteWeddingDateApiError,
  RemoteWeddingDateRequestAbortedError,
} from "../data-source/remoteWeddingDateDataSource";
import {
  createWeddingDateRepository,
  WeddingDateAuthenticationRequiredError,
  WeddingDateInvalidRequestError,
  WeddingDateLoadError,
  WeddingDateRequestAbortedError,
  WeddingDateSaveError,
} from "./weddingDateRepository";

function createDataSource() {
  return {
    getWeddingDate: vi.fn(),
    saveWeddingDate: vi.fn(),
  };
}

describe("weddingDateRepository", () => {
  it("GET null과 저장한 날짜를 전달한다", async () => {
    const dataSource = createDataSource();
    dataSource.getWeddingDate.mockResolvedValue(null);
    dataSource.saveWeddingDate.mockResolvedValue("2027-05-15");
    const repository = createWeddingDateRepository(dataSource);
    const signal = new AbortController().signal;

    await expect(repository.getWeddingDate(signal)).resolves.toBeNull();
    await expect(
      repository.saveWeddingDate("2027-05-15", signal),
    ).resolves.toBe("2027-05-15");
    expect(dataSource.getWeddingDate).toHaveBeenCalledWith(signal);
    expect(dataSource.saveWeddingDate).toHaveBeenCalledWith(
      "2027-05-15",
      signal,
    );
  });

  it.each([
    [
      new RemoteWeddingDateApiError(401, 201),
      WeddingDateAuthenticationRequiredError,
    ],
    [
      new RemoteWeddingDateRequestAbortedError(),
      WeddingDateRequestAbortedError,
    ],
    [new RemoteWeddingDateApiError(500, 0), WeddingDateLoadError],
  ])("조회 오류를 안전한 도메인 오류로 변환한다", async (error, expected) => {
    const dataSource = createDataSource();
    dataSource.getWeddingDate.mockRejectedValue(error);
    await expect(
      createWeddingDateRepository(dataSource).getWeddingDate(),
    ).rejects.toBeInstanceOf(expected);
  });

  it.each([
    [new RemoteWeddingDateApiError(400, 101), WeddingDateInvalidRequestError],
    [
      new RemoteWeddingDateApiError(401, 201),
      WeddingDateAuthenticationRequiredError,
    ],
    [
      new RemoteWeddingDateRequestAbortedError(),
      WeddingDateRequestAbortedError,
    ],
    [new Error("internal secret"), WeddingDateSaveError],
  ])("저장 오류를 안전한 도메인 오류로 변환한다", async (error, expected) => {
    const dataSource = createDataSource();
    dataSource.saveWeddingDate.mockRejectedValue(error);
    await expect(
      createWeddingDateRepository(dataSource).saveWeddingDate("2027-05-15"),
    ).rejects.toBeInstanceOf(expected);
  });
});
