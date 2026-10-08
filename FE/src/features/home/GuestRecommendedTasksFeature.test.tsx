import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogRepository } from "../catalog";
import { usePreparationChecklistRepository } from "../preparation";
import { preparationCatalogFixture } from "../preparation/test/fixtures/preparationCatalog.fixture";
import { GuestRecommendedTasksFeature } from "./GuestRecommendedTasksFeature";

vi.mock("../catalog", () => ({ catalogRepository: { getCatalog: vi.fn() } }));
vi.mock("../preparation", () => ({
  usePreparationChecklistRepository: vi.fn(),
  PreparationAuthenticationRequiredError: class extends Error {},
}));
vi.mock("../../infrastructure/analytics", () => ({
  analytics: { track: vi.fn() },
}));

const repository = {
  getCatalogItemIds: vi.fn(),
  addCatalogItemIds: vi.fn(),
};
const catalog = {
  ...preparationCatalogFixture,
  stepDetails: preparationCatalogFixture.stepDetails.map((detail) => ({
    ...detail,
    tasks: detail.tasks.map((task) =>
      task.id === "1001" ? { ...task, title: "드레스샵 투어" } : task,
    ),
  })),
};

function renderFeature(audience: "guest" | "authenticated" = "guest") {
  render(
    <MemoryRouter>
      <GuestRecommendedTasksFeature audience={audience} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(usePreparationChecklistRepository).mockReturnValue(repository);
  vi.mocked(catalogRepository.getCatalog)
    .mockReset()
    .mockResolvedValue(catalog);
  repository.getCatalogItemIds.mockReset().mockResolvedValue([]);
  repository.addCatalogItemIds.mockReset().mockResolvedValue(["101"]);
});

describe("GuestRecommendedTasksFeature", () => {
  it("처음 시작할 할 일만 표시하고 실제 카탈로그 ID로 비로그인 체크리스트에 추가한다", async () => {
    renderFeature();
    expect(
      await screen.findByRole("heading", { name: "웨딩홀 투어" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "드레스샵 투어" })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "웨딩홀 견적 비교" }),
    ).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", { name: "내 할 일에 추가" })[0],
    );
    await waitFor(() =>
      expect(repository.addCatalogItemIds).toHaveBeenCalledWith(
        "guest",
        ["101"],
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "웨딩홀 투어" })).toBeNull(),
    );
  });

  it("로그인한 첫 사용자도 시작 항목을 실제 내 체크리스트에 추가한다", async () => {
    renderFeature("authenticated");
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "내 할 일에 추가" }))[0],
    );
    await waitFor(() =>
      expect(repository.addCatalogItemIds).toHaveBeenCalledWith(
        "authenticated",
        ["101"],
        expect.any(AbortSignal),
      ),
    );
    expect(repository.getCatalogItemIds).toHaveBeenCalledWith(
      "authenticated",
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "웨딩홀 투어" })).toBeNull(),
    );
  });

  it("이전에 담아둔 할 일은 추가됨으로 표시해 중복 추가를 막는다", async () => {
    repository.getCatalogItemIds.mockResolvedValue(["101"]);
    renderFeature();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "웨딩홀 투어" })).toBeNull(),
    );
    expect(
      screen.getAllByRole("button", { name: "내 할 일에 추가" }),
    ).toHaveLength(1);
    expect(repository.addCatalogItemIds).not.toHaveBeenCalled();
  });

  it("시작 투어를 모두 담았어도 남은 첫 단계 준비를 추천하고 중복 항목은 제외한다", async () => {
    repository.getCatalogItemIds.mockResolvedValue(["101", "1001"]);
    renderFeature();
    expect(
      await screen.findByRole("heading", { name: "웨딩홀 견적 비교" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "웨딩홀 투어" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "드레스샵 투어" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "예식 형태 결정" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "내 할 일에 추가" }));
    await waitFor(() =>
      expect(repository.addCatalogItemIds).toHaveBeenCalledWith(
        "guest",
        ["102"],
        expect.any(AbortSignal),
      ),
    );
  });

  it("로컬 저장이 실패하면 다시 시도할 수 있다", async () => {
    repository.addCatalogItemIds.mockRejectedValueOnce(new Error("저장 실패"));
    renderFeature();
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "내 할 일에 추가" }))[0],
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "웨딩홀 투어" })).toBeNull(),
    );
  });

  it("카탈로그 조회가 실패하면 재시도와 로드맵 이동을 제공한다", async () => {
    vi.mocked(catalogRepository.getCatalog).mockRejectedValueOnce(
      new Error("조회 실패"),
    );
    renderFeature();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /로드맵 전체 보기/ })
        .getAttribute("href"),
    ).toBe("/preparation");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(
      await screen.findByRole("heading", { name: "웨딩홀 투어" }),
    ).toBeTruthy();
  });
});
