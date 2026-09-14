import { describe, expect, it } from "vitest";
import {
  authenticatedPreparationCatalogResponseFixture,
  publicPreparationCatalogResponseFixture,
} from "../test/fixtures/preparationCatalogResponse.fixture";
import { parsePreparationCatalogResponse } from "./preparationCatalogResponse";

describe("parsePreparationCatalogResponse", () => {
  it("공개 응답을 표시 순서에 맞는 화면 모델로 변환한다", () => {
    const model = parsePreparationCatalogResponse(
      publicPreparationCatalogResponseFixture,
    );

    expect(model.categories.map((category) => category.id)).toEqual([
      "10",
      "20",
    ]);
    expect(model.roadmaps[0].steps[0]).toEqual({
      iconUrl: undefined,
      id: "100",
      order: 1,
      title: "준비 단계",
    });
    expect(model.stepDetails[0]).toEqual({
      description: "",
      stepId: "100",
      tasks: [
        {
          essential: true,
          id: "1001",
          included: false,
          title: "첫 번째 할 일",
        },
        {
          essential: false,
          id: "1002",
          included: false,
          title: "두 번째 할 일",
        },
      ],
    });
  });

  it("nullable 선택 필드가 생략된 응답도 처리한다", () => {
    const responseWithoutOptionalFields = structuredClone(
      publicPreparationCatalogResponseFixture,
    );
    Reflect.deleteProperty(
      responseWithoutOptionalFields.categories[1].steps[0],
      "description",
    );
    Reflect.deleteProperty(
      responseWithoutOptionalFields.categories[1].steps[0],
      "iconUrl",
    );

    expect(() =>
      parsePreparationCatalogResponse(responseWithoutOptionalFields),
    ).not.toThrow();
  });

  it("응답에 포함된 included 값은 그대로 유지한다", () => {
    const model = parsePreparationCatalogResponse(
      authenticatedPreparationCatalogResponseFixture,
    );

    expect(
      model.stepDetails.flatMap((step) =>
        step.tasks.map((task) => task.included),
      ),
    ).toEqual([true, false]);
  });
});
