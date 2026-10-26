import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import { installMatchMedia } from "../../test/matchMedia";
import { dateLabel } from "../date-picker/date-utils";
import { PickerField } from "./PickerField";

afterEach(() => vi.unstubAllGlobals());

function Harness({
  kind = "time",
  initial = "09:13",
  onChange = vi.fn(),
}: {
  kind?: "date" | "time";
  initial?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PickerField
      label={kind === "time" ? "시작 시간" : "날짜"}
      {...(kind === "time" ? { kind, minuteStep: 1 as const } : { kind })}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe.each([false, true])("PickerField (모바일=%s)", (mobile) => {
  it("시간을 지운 뒤 표시된 자정을 다시 선택하면 00:00으로 확정한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "시작 시간 09:13" }));
    const panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    fireEvent.click(within(panel).getByRole("button", { name: "시간 지우기" }));
    expect(within(panel).getByRole("status").textContent).toContain("미지정");
    fireEvent.click(
      within(within(panel).getByRole("listbox", { name: "분" })).getByRole(
        "option",
        { name: "00" },
      ),
    );
    expect(within(panel).getByRole("status").textContent).toContain("00:00");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("00:00");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "시작 시간 선택" }),
      ).toBeNull(),
    );
  });

  it("휠을 움직인 직후 확인해도 최신 시간을 확정한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "시작 시간 09:13" }));
    const panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    const minutes = within(panel).getByRole("listbox", { name: "분" });
    minutes.scrollTop = 17 * 44;
    fireEvent.scroll(minutes);
    fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("09:17");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "시작 시간 선택" }),
      ).toBeNull(),
    );
  });
  it("1분 값을 보존하고, 임시 선택 취소·확인 뒤에 필드로 초점을 돌린다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    let trigger = screen.getByRole("button", { name: "시작 시간 09:13" });
    trigger.focus();
    fireEvent.click(trigger);
    let panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    let minutes = within(panel).getByRole("listbox", { name: "분" });
    expect(
      within(minutes)
        .getByRole("option", { name: "13" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(minutes, { key: "ArrowDown" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(minutes, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "시작 시간 선택" }),
      ).toBeNull(),
    );
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    minutes = within(panel).getByRole("listbox", { name: "분" });
    expect(
      within(minutes)
        .getByRole("option", { name: "13" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(minutes, { key: "ArrowDown" });
    fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "시작 시간 선택" }),
      ).toBeNull(),
    );
    expect(onChange).toHaveBeenCalledExactlyOnceWith("09:14");
    trigger = screen.getByRole("button", { name: "시작 시간 09:14" });
    expect(document.activeElement).toBe(trigger);
  });

  it("날짜도 확인 전에는 반영하지 않고 배경 닫기로 임시 선택을 취소한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
    const onChange = vi.fn();
    render(<Harness kind="date" initial="2026-10-26" onChange={onChange} />);
    const open = () =>
      fireEvent.click(screen.getByRole("button", { name: "날짜 2026-10-26" }));
    open();
    let panel = screen.getByRole("dialog", { name: "날짜 선택" });
    fireEvent.click(
      within(panel).getByRole("gridcell", { name: dateLabel("2026-10-27") }),
    );
    expect(onChange).not.toHaveBeenCalled();
    if (mobile) {
      fireEvent.pointerDown(panel);
      fireEvent.pointerUp(panel);
    } else fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull(),
    );
    open();
    panel = screen.getByRole("dialog", { name: "날짜 선택" });
    expect(
      within(panel)
        .getByRole("gridcell", { name: dateLabel("2026-10-26") })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.click(
      within(panel).getByRole("gridcell", { name: dateLabel("2026-10-27") }),
    );
    fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-27");
  });

  it("미지정 시간은 열기만 해서는 채우지 않고 지우기도 확인할 때만 반영한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
    const onChange = vi.fn();
    render(<Harness initial="" onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: "시작 시간 시간 선택" }),
    );
    let panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    fireEvent.keyDown(within(panel).getByRole("listbox", { name: "시" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "시작 시간 선택" }),
      ).toBeNull(),
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "시작 시간 시간 선택" }),
    );
    panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    fireEvent.click(within(panel).getByRole("button", { name: "시간 지우기" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  });
});

it.each([false, true])(
  "화면 크기 전환 후 모바일=%s에서도 선택과 초점 복귀를 유지한다",
  async (mobile) => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "시작 시간 09:13" }));
    fireEvent.keyDown(screen.getByRole("listbox", { name: "분" }), {
      key: "ArrowDown",
    });
    act(() => media.setMatches(true));
    let panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(
      within(panel)
        .getByRole("option", { name: "14" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    act(() => media.setMatches(mobile));
    panel = screen.getByRole("dialog", { name: "시작 시간 선택" });
    expect(panel.getAttribute("aria-modal")).toBe(String(mobile));
    expect(
      within(panel)
        .getByRole("option", { name: "14" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.click(within(panel).getByRole("button", { name: "확인" }));
    const trigger = screen.getByRole("button", { name: "시작 시간 09:14" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  },
);

it.each(["date", "time"] as const)(
  "모바일 %s 선택기는 퇴장 완료까지 본문을 유지한다",
  async (kind) => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    const onChange = vi.fn();
    render(
      <Harness
        kind={kind}
        initial={kind === "date" ? "2026-10-26" : "09:13"}
        onChange={onChange}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: kind === "date" ? "날짜 2026-10-26" : "시작 시간 09:13",
    });
    trigger.focus();
    fireEvent.click(trigger);
    const layer = screen.getByRole("dialog");
    const picker =
      kind === "date"
        ? within(layer).getByRole("grid")
        : within(layer).getByRole("listbox", { name: "분" });
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    Object.defineProperty(layer.firstElementChild, "getAnimations", {
      value: () => [{ finished }],
    });
    fireEvent.keyDown(layer, { key: "Escape" });
    expect(layer.dataset.state).toBe("closing");
    expect(layer.contains(picker)).toBe(true);
    expect(picker.isConnected).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(picker.isConnected).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  },
);
