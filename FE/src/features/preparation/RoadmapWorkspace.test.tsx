import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "../../test/memoryNavigation";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../auth/model/auth";
import { installMatchMedia } from "../../test/matchMedia";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
const mocks = vi.hoisted(() => ({
  auth: {
    status: "authenticated",
    user: { id: 1, nickname: "비비디" },
  } as AuthState,
  catalog: vi.fn(),
  ids: vi.fn(),
  add: vi.fn(),
  query: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../auth", () => ({
  useAuth: () => ({ authState: mocks.auth, refreshAuth: mocks.refresh }),
}));
vi.mock("../../infrastructure/analytics", () => ({
  analytics: { track: vi.fn() },
}));
vi.mock("./preparationDependencies", () => {
  const repository = {
    getCatalogItemIds: mocks.ids,
    addCatalogItemIds: mocks.add,
  };
  return {
    usePreparationChecklistRepository: () => repository,
  };
});
vi.mock("../catalog", () => ({
  catalogRepository: { getCatalog: mocks.catalog },
}));
vi.mock("../checklist", async (importOriginal) => {
  const repository = { getChecklist: mocks.query };
  return {
    ...(await importOriginal<typeof import("../checklist")>()),
    useMyChecklistQueryRepository: () => repository,
    useMyChecklistRevision: () => 0,
  };
});
import { PreparationRoadmapFeature } from "./PreparationRoadmapFeature";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";
function Location() {
  const l = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="현재 주소">
        {l.pathname}
        {l.search}
      </output>
      <button
        onClick={() =>
          navigate("/preparation?categoryId=studio-dress-makeup&other=keep")
        }
      >
        카테고리 링크로 이동
      </button>
    </>
  );
}
function workspace(url = "/preparation") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/preparation" element={<PreparationRoadmapFeature />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { status: "authenticated", user: { id: 1, nickname: "비비디" } };
  mocks.catalog.mockResolvedValue(preparationCatalogFixture);
  mocks.ids.mockResolvedValue([]);
  mocks.query.mockResolvedValue({ exists: true, items: [] });
  mocks.add.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("통합 로드맵 작업 공간", () => {
  it.each(["authenticated", "guest"] as const)(
    "%s는 동일한 로드맵으로 진입한다",
    async (audience) => {
      if (audience === "guest") mocks.auth = { status: "guest" };
      workspace();
      await screen.findByRole("heading", { name: "웨딩홀" });
      expect(
        screen.getByRole("heading", { name: "웨딩홀", level: 1 }),
      ).toBeTruthy();
      const breadcrumb = screen.getByRole("navigation", { name: "현재 위치" });
      expect(within(breadcrumb).getByText("로드맵")).toBeTruthy();
      expect(
        within(breadcrumb).getByText("웨딩홀").getAttribute("aria-current"),
      ).toBe("page");
      expect(screen.getByRole("list", { name: "준비 단계" })).toBeTruthy();
      expect(
        screen.queryByRole("navigation", { name: "로드맵 보기" }),
      ).toBeNull();
    },
  );
  it("방향키와 Home·End로 탭 선택·초점·콘텐츠·URL을 함께 변경한다", async () => {
    workspace("/preparation?other=keep");
    const first = await screen.findByRole("tab", { name: "웨딩홀" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const last = screen.getByRole("tab", { name: "스드메" });
    expect(document.activeElement).toBe(last);
    expect(last.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      last.id,
    );
    expect(screen.getByLabelText("현재 주소").textContent).toContain(
      "categoryId=studio-dress-makeup",
    );
    expect(screen.getByLabelText("현재 주소").textContent).toContain(
      "other=keep",
    );
    fireEvent.keyDown(last, { key: "Home" });
    expect(document.activeElement).toBe(first);
    expect(first.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(first, { key: "End" });
    expect(document.activeElement).toBe(last);
  });
  it("카테고리 직접 진입과 선택 시 다른 URL 매개변수를 유지한다", async () => {
    workspace("/preparation?categoryId=studio-dress-makeup&other=keep");
    await screen.findByRole("heading", { name: "스드메" });
    fireEvent.click(screen.getByRole("tab", { name: "웨딩홀" }));
    expect(screen.getByRole("heading", { name: "웨딩홀" })).toBeTruthy();
    expect(screen.getByLabelText("현재 주소").textContent).toBe(
      "/preparation?categoryId=wedding-hall&other=keep",
    );
  });
  it("같은 페이지의 카테고리 링크로 이동하면 선택과 카드를 갱신한다", async () => {
    workspace();
    await screen.findByRole("heading", { name: "웨딩홀" });
    fireEvent.click(
      screen.getByRole("button", { name: "카테고리 링크로 이동" }),
    );
    await screen.findByRole("heading", { name: "스드메" });
    expect(
      within(screen.getByRole("navigation", { name: "현재 위치" }))
        .getByText("스드메")
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("button", { name: "01 스드메 상담·견적과 패키지 계약" }),
    ).toBeTruthy();
  });
  it("단계 모달은 관리 링크 없이 확인으로 닫고 로드맵에 머문다", async () => {
    workspace();
    const trigger = await screen.findByRole("button", {
      name: "01 웨딩홀 투어와 계약",
    });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("link")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "닫기" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("현재 주소").textContent).toBe("/preparation");
  });
  it("모바일도 보기 선택 시트를 거치지 않고 카테고리와 단계만 선택한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    workspace();
    await screen.findByRole("heading", { name: "웨딩홀" });
    expect(screen.queryByRole("button", { name: "내 로드맵" })).toBeNull();
    expect(screen.queryByRole("button", { name: "전체 단계" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "스드메" }));
    fireEvent.click(
      screen.getByRole("button", { name: "01 스드메 상담·견적과 패키지 계약" }),
    );
    expect(
      (await screen.findByRole("dialog")).classList.contains(
        "bibbidi-bottom-sheet",
      ),
    ).toBe(true);
  });
  it("인증 조회 중에도 공개 로드맵을 표시한다", async () => {
    mocks.auth = { status: "loading" };
    workspace();
    expect(await screen.findByRole("list", { name: "준비 단계" })).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("인증 실패에도 공개 로드맵을 표시하고 현황 재시도로 인증을 갱신한다", async () => {
    mocks.auth = { status: "error" };
    workspace();
    expect(await screen.findByRole("list", { name: "준비 단계" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "현황 다시 불러오기" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.catalog).toHaveBeenCalledOnce();
  });
});
