import { describe, expect, it, vi } from "vitest";
import {
  createLocalChecklistDataSource,
  LocalChecklistStorageError,
} from "./localChecklistDataSource";

const STORAGE_KEY = "bibbidi:preparation-checklist";

function createStorage(serializedValue: string | null = null) {
  return {
    getItem: vi.fn().mockReturnValue(serializedValue),
    setItem: vi.fn(),
  } as unknown as Storage;
}

describe("LocalChecklistDataSource", () => {
  it("저장된 값이 없으면 빈 항목 ID 목록을 반환한다", () => {
    const storage = createStorage();
    const dataSource = createLocalChecklistDataSource(() => storage);

    expect(dataSource.getCatalogItemIds()).toEqual([]);
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("현재 버전의 양의 정수 ID만 중복 없이 읽는다", () => {
    const storage = createStorage(
      JSON.stringify({
        version: 1,
        catalogItemIds: [101, 102, 101, 0, -1, 1.5, "103", null],
      }),
    );
    const dataSource = createLocalChecklistDataSource(() => storage);

    expect(dataSource.getCatalogItemIds()).toEqual([101, 102]);
  });

  it.each([
    ["올바르지 않은 JSON", "{"],
    [
      "지원하지 않는 버전",
      JSON.stringify({ version: 2, catalogItemIds: [101] }),
    ],
    [
      "배열이 아닌 항목 목록",
      JSON.stringify({ version: 1, catalogItemIds: 101 }),
    ],
    ["객체가 아닌 값", JSON.stringify([101])],
  ])("%s은 빈 목록으로 취급하고 저장 값을 수정하지 않는다", (_name, value) => {
    const storage = createStorage(value);
    const dataSource = createLocalChecklistDataSource(() => storage);

    expect(dataSource.getCatalogItemIds()).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("저장할 때 ID를 검증하고 중복을 제거한 현재 스키마로 정규화한다", () => {
    const storage = createStorage();
    const dataSource = createLocalChecklistDataSource(() => storage);

    dataSource.setCatalogItemIds([101, 102, 101, 0, -1, 1.5]);

    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ version: 1, catalogItemIds: [101, 102] }),
    );
  });

  it("저장소 읽기 실패를 DataSource 오류로 변환한다", () => {
    const storage = createStorage();
    vi.mocked(storage.getItem).mockImplementation(() => {
      throw new Error("blocked");
    });
    const dataSource = createLocalChecklistDataSource(() => storage);

    expect(() => dataSource.getCatalogItemIds()).toThrowError(
      LocalChecklistStorageError,
    );

    try {
      dataSource.getCatalogItemIds();
    } catch (error) {
      expect(error).toMatchObject({ operation: "read" });
    }
  });

  it("저장소 쓰기 실패를 DataSource 오류로 변환한다", () => {
    const storage = createStorage();
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new Error("full");
    });
    const dataSource = createLocalChecklistDataSource(() => storage);

    expect(() => dataSource.setCatalogItemIds([101])).toThrowError(
      LocalChecklistStorageError,
    );

    try {
      dataSource.setCatalogItemIds([101]);
    } catch (error) {
      expect(error).toMatchObject({ operation: "write" });
    }
  });
});
