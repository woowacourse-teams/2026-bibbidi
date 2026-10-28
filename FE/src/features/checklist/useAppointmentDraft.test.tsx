import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAppointmentDraft } from "./useAppointmentDraft";

describe("일정 입력 상태", () => {
  it.each([
    {
      field: "title" as const,
      change: "changeTitle" as const,
      touch: "touchTitle" as const,
      invalid: "가".repeat(256),
      valid: "방문 상담",
      error: "일정 제목은 255자 이하로 입력해 주세요.",
    },
    {
      field: "date" as const,
      change: "changeDate" as const,
      touch: "touchDate" as const,
      invalid: "2026-02-30",
      valid: "2026-02-28",
      error: "날짜를 YYYY-MM-DD 형식의 유효한 날짜로 입력해 주세요.",
    },
    {
      field: "place" as const,
      change: "changePlace" as const,
      touch: "touchPlace" as const,
      invalid: "가".repeat(256),
      valid: "웨딩홀",
      error: "장소는 255자 이하로 입력해 주세요.",
    },
  ])(
    "$field 오류는 blur 후 표시하고 수정하면 재검증한다",
    ({ field, change, touch, invalid, valid, error }) => {
      const { result } = renderHook(useAppointmentDraft);
      act(() => result.current.form[change](invalid));
      expect(result.current.form.errors[field]).toBeUndefined();
      act(() => result.current.form[touch]());
      expect(result.current.form.errors[field]).toBe(error);
      act(() => result.current.form[change](valid));
      expect(result.current.form.draft[field]).toBe(valid);
      expect(result.current.form.errors[field]).toBeUndefined();
    },
  );

  it("시작 시간 blur에서 종료 시간 순서를 갱신하고 형식 오류를 보존한다", () => {
    const { result } = renderHook(useAppointmentDraft);
    act(() => {
      result.current.form.changeEndTime("10:00");
      result.current.form.changeStartTime("11:00");
    });
    act(() => result.current.form.touchStartTime());
    expect(result.current.form.errors.endTime).toBe(
      "종료 시간은 시작 시간보다 빠를 수 없어요.",
    );

    act(() => result.current.form.changeStartTime("09:00"));
    expect(result.current.form.errors.endTime).toBeUndefined();
    act(() => result.current.form.changeStartTime("11:00"));
    act(() => result.current.form.touchStartTime());
    expect(result.current.form.errors.endTime).toBe(
      "종료 시간은 시작 시간보다 빠를 수 없어요.",
    );

    act(() => result.current.form.changeEndTime("99:00"));
    expect(result.current.form.errors.endTime).toBe(
      "종료 시간을 HH:mm 형식으로 입력해 주세요.",
    );
    act(() => result.current.form.changeStartTime("08:00"));
    act(() => result.current.form.touchStartTime());
    expect(result.current.form.errors.endTime).toBe(
      "종료 시간을 HH:mm 형식으로 입력해 주세요.",
    );
  });
});
