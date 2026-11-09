import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPageContentTiming, type TimingRouter } from "./pageContentTiming";

let now: number;
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let hidden: boolean;
let stop: () => void;

beforeEach(() => {
  now = 80;
  frameId = 0;
  hidden = false;
  frames = new Map();
  document.body.innerHTML = '<div id="root"></div>';
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() =>
    hidden ? "hidden" : "visible",
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  stop = () => {};
});
afterEach(() => {
  stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function setup(path = "/preparation") {
  let notify: Parameters<TimingRouter["subscribe"]>[0] = () => {};
  const router: TimingRouter = {
    state: { location: { pathname: path }, navigation: {} },
    subscribe: vi.fn((callback) => {
      notify = callback;
      return vi.fn();
    }),
  };
  const track = vi.fn();
  stop = startPageContentTiming(router, track);
  return {
    track,
    navigate: (pathname: string) =>
      notify({ location: { pathname }, navigation: {} }),
    pending: (pathname: string) =>
      notify({
        location: router.state.location,
        navigation: { location: { pathname } },
      }),
  };
}
async function content(state: string) {
  document.getElementById("root")!.innerHTML =
    `<div class="preparation-catalog-page"><div data-page-content-state="${state}"></div></div>`;
  await Promise.resolve();
}
function paint() {
  for (let index = 0; index < 2; index++) {
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach((callback) => callback(now));
  }
}

describe("준비 목록 첫 콘텐츠 시간", () => {
  it("인증 대기와 로딩을 포함해 문서 시작부터 성공 DOM의 두 프레임 뒤까지 한 번 기록한다", async () => {
    const { track } = setup();
    await content("loading");
    now = 1200;
    paint();
    expect(track).not.toHaveBeenCalled();
    await content("success");
    expect(track).not.toHaveBeenCalled();
    now = 1240;
    paint();
    expect(track).toHaveBeenCalledExactlyOnceWith({
      name: "page_content_timing",
      parameters: {
        page_path: "/preparation",
        screen_name: "preparation_catalog",
        measurement_id: "content-1",
        navigation_kind: "document",
        duration_ms: 1240,
        outcome: "success",
      },
    });
    await content("loading");
    await content("success");
    paint();
    expect(track).toHaveBeenCalledOnce();
  });
  it.each(["empty", "error", "authentication-required"])(
    "%s를 성공과 구분한다",
    async (state) => {
      const { track } = setup();
      await content(state);
      paint();
      expect(track.mock.calls[0][0].parameters.outcome).toBe(
        state.replaceAll("-", "_"),
      );
    },
  );
  it("내부 이동은 lazy route가 준비되기 전 목적 경로 관찰부터 측정한다", async () => {
    const { track, pending, navigate } = setup("/calendar");
    now = 300;
    pending("/preparation");
    now = 500;
    navigate("/preparation");
    await content("success");
    now = 620;
    paint();
    expect(track.mock.calls[0][0].parameters).toMatchObject({
      navigation_kind: "spa",
      duration_ms: 320,
    });
    navigate("/preparation");
    expect(track).toHaveBeenCalledOnce();
  });
  it("완료 전 다른 화면으로 나가면 이탈을 기록하고 늦게 도착한 DOM은 무시한다", async () => {
    const { track, navigate } = setup("/");
    now = 700;
    navigate("/calendar");
    await content("success");
    paint();
    expect(track).toHaveBeenCalledOnce();
    expect(track.mock.calls[0][0].parameters).toMatchObject({
      page_path: "/",
      outcome: "abandoned",
      duration_ms: 700,
    });
  });
  it("이전 준비 화면의 DOM이 남아 있으면 새 경로의 commit 전에는 완료하지 않는다", async () => {
    const { track, pending, navigate } = setup("/");
    await content("success");
    paint();
    now = 300;
    pending("/preparation");
    paint();
    expect(track).toHaveBeenCalledOnce();
    now = 500;
    navigate("/preparation");
    paint();
    expect(track).toHaveBeenCalledTimes(2);
    expect(track.mock.calls[1][0].parameters.duration_ms).toBe(200);
  });
  it("두 프레임 사이의 화면 이탈은 성공으로 보내지 않는다", async () => {
    const { track, navigate } = setup();
    await content("success");
    navigate("/calendar");
    paint();
    expect(track).toHaveBeenCalledOnce();
    expect(track.mock.calls[0][0].parameters.outcome).toBe("abandoned");
  });
  it("백그라운드 대기를 성공 시간에 합산하지 않는다", async () => {
    const { track } = setup();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    hidden = false;
    await content("success");
    paint();
    expect(track).toHaveBeenCalledOnce();
    expect(track.mock.calls[0][0].parameters.outcome).toBe("hidden");
  });
  it("정리 뒤에는 DOM·이동·페이지 종료를 수집하지 않는다", async () => {
    const { track } = setup();
    stop();
    await content("success");
    window.dispatchEvent(new Event("pagehide"));
    paint();
    expect(track).not.toHaveBeenCalled();
  });
  it("계측 전송 오류가 화면 이동을 막지 않는다", () => {
    const { track, navigate } = setup();
    track.mockImplementation(() => {
      throw new Error("SDK failure");
    });
    expect(() => navigate("/calendar")).not.toThrow();
  });
});
