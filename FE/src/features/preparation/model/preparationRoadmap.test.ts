import { describe, expect, it } from "vitest";
import { preparationCatalogFixture } from "../test/fixtures/preparationCatalog.fixture";
import { applyChecklistCatalogItemIds } from "./preparationRoadmap";

describe("applyChecklistCatalogItemIds", () => {
  it("카탈로그에 존재하는 체크리스트 ID만 포함 상태로 반영한다", () => {
    const catalog = applyChecklistCatalogItemIds(preparationCatalogFixture, [
      "102",
      "999999",
    ]);

    expect(catalog.stepDetails[0].tasks).toMatchObject([
      { id: "101", included: false },
      { id: "102", included: true },
    ]);
    expect(catalog.stepDetails[1].tasks[0]).toMatchObject({
      id: "201",
      included: false,
    });
  });

  it("원본 카탈로그를 변경하지 않는다", () => {
    const originalCatalog = structuredClone(preparationCatalogFixture);

    applyChecklistCatalogItemIds(preparationCatalogFixture, ["102"]);

    expect(preparationCatalogFixture).toEqual(originalCatalog);
  });
});
