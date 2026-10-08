import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../../shared/responsive";
import { installMatchMedia } from "../../../test/matchMedia";
import {
  ChecklistTaskCreationInput,
  ChecklistTaskCreationSubmissionState,
  useChecklistTaskCreation,
} from "../useChecklistTaskCreation";
import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskCreation } from "./ChecklistTaskCreation";

const categories: ChecklistCategoryViewModel[] = [
  {
    completedCount: 0,
    countLabel: "0개",
    groups: [],
    id: "10",
    progress: 0,
    progressLabel: "0%",
    tasks: [],
    title: "예식장",
    totalCount: 0,
  },
  {
    completedCount: 0,
    countLabel: "0개",
    groups: [],
    id: "20",
    progress: 0,
    progressLabel: "0%",
    tasks: [],
    title: "청첩장·하객",
    totalCount: 0,
  },
];

interface CreationHarnessProps {
  onSubmit?: (
    input: ChecklistTaskCreationInput,
  ) => Promise<boolean | void> | boolean | void;
  submissionState?: ChecklistTaskCreationSubmissionState;
}

function CreationHarness({ onSubmit, submissionState }: CreationHarnessProps) {
  const controller = useChecklistTaskCreation({
    onSubmit,
    submissionState,
  });

  return (
    <>
      <button onClick={controller.open} type="button">
        할 일 추가 열기
      </button>
      {controller.isOpen ? (
        <ChecklistTaskCreation
          categories={categories}
          controller={controller}
        />
      ) : null}
    </>
  );
}

function StatefulCreationHarness({
  onSubmit,
}: {
  onSubmit: (input: ChecklistTaskCreationInput) => void;
}) {
  const [submissionState, setSubmissionState] =
    useState<ChecklistTaskCreationSubmissionState>({ status: "idle" });

  return (
    <>
      <button
        onClick={() => setSubmissionState({ status: "submitting" })}
        type="button"
      >
        제출 중 주입
      </button>
      <button
        onClick={() =>
          setSubmissionState({
            message: "서버가 요청을 처리하지 못했어요.",
            status: "error",
          })
        }
        type="button"
      >
        실패 주입
      </button>
      <button
        onClick={() => setSubmissionState({ status: "success" })}
        type="button"
      >
        성공 주입
      </button>
      <CreationHarness onSubmit={onSubmit} submissionState={submissionState} />
    </>
  );
}

function SessionAwareCreationHarness({
  onOpenChange,
  sessionIdentity,
}: {
  onOpenChange: (isOpen: boolean) => void;
  sessionIdentity: string;
}) {
  useChecklistTaskCreation({ onOpenChange, sessionIdentity });

  return null;
}

function openForm() {
  fireEvent.click(screen.getByRole("button", { name: "할 일 추가 열기" }));
  return screen.getByRole("complementary", { name: "할 일 추가" });
}

beforeEach(() => {
  installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("할 일 추가 폼", () => {
  it.each([
    ["void", () => undefined],
    ["Promise<void>", () => Promise.resolve(undefined)],
    ["true", () => true],
  ])(
    "%s 제출 성공 시 작성 화면과 draft를 초기화한다",
    async (_label, onSubmit) => {
      render(<CreationHarness onSubmit={onSubmit} />);
      const panel = openForm();
      fireEvent.change(within(panel).getByRole("textbox"), {
        target: { value: "새 할 일" },
      });
      fireEvent.change(within(panel).getByRole("combobox"), {
        target: { value: "10" },
      });
      fireEvent.click(within(panel).getByRole("button", { name: "추가" }));

      await act(async () => {
        await Promise.resolve();
      });
      expect(
        screen.queryByRole("complementary", { name: "할 일 추가" }),
      ).toBeNull();

      const reopenedPanel = openForm();
      expect(
        (within(reopenedPanel).getByRole("textbox") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (within(reopenedPanel).getByRole("combobox") as HTMLSelectElement)
          .value,
      ).toBe("");
    },
  );

  it("명시적 false 제출 실패 시 작성 화면과 draft를 유지한다", async () => {
    render(<CreationHarness onSubmit={() => false} />);
    const panel = openForm();
    fireEvent.change(within(panel).getByRole("textbox"), {
      target: { value: "작성 중인 할 일" },
    });
    fireEvent.change(within(panel).getByRole("combobox"), {
      target: { value: "20" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "추가" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("complementary", { name: "할 일 추가" })).toBe(
      panel,
    );
    expect((within(panel).getByRole("textbox") as HTMLInputElement).value).toBe(
      "작성 중인 할 일",
    );
    expect(
      (within(panel).getByRole("combobox") as HTMLSelectElement).value,
    ).toBe("20");
  });

  it("닫힌 작성 세션은 사용자 변경 시 중복 close navigation을 만들지 않는다", async () => {
    const onOpenChange = vi.fn();
    const view = render(
      <SessionAwareCreationHarness
        onOpenChange={onOpenChange}
        sessionIdentity="authenticated:first"
      />,
    );

    view.rerender(
      <SessionAwareCreationHarness
        onOpenChange={onOpenChange}
        sessionIdentity="authenticated:second"
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("데스크톱 패널을 열고 제목 입력에 초점을 둔다", () => {
    render(<CreationHarness onSubmit={vi.fn()} />);

    const panel = openForm();
    const title = within(panel).getByRole("textbox", { name: /할 일 제목/ });

    expect(panel.classList.contains("checklist-task-creation--desktop")).toBe(
      true,
    );
    expect(document.activeElement).toBe(title);
    expect(within(panel).getByText("0 / 50")).toBeTruthy();
  });

  it("모바일 전체 화면을 표시하고 breakpoint 전환에도 draft를 유지한다", () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    render(<CreationHarness onSubmit={vi.fn()} />);
    openForm();
    const title = screen.getByRole("textbox", { name: /할 일 제목/ });
    fireEvent.change(title, { target: { value: "청첩장 문구 확인" } });
    fireEvent.change(screen.getByRole("combobox", { name: /카테고리/ }), {
      target: { value: "20" },
    });

    act(() => media.setMatches(true));

    const page = screen.getByRole("dialog", { name: "할 일 추가" });
    expect(page.classList.contains("checklist-task-creation--mobile")).toBe(
      true,
    );
    expect(within(page).getByDisplayValue("청첩장 문구 확인")).toBeTruthy();
    expect(
      (
        within(page).getByRole("combobox", {
          name: /카테고리/,
        }) as HTMLSelectElement
      ).value,
    ).toBe("20");

    const backButton = within(page).getByRole("button", {
      name: "체크리스트로 돌아가기",
    });
    const submitButton = within(page).getByRole("button", { name: "추가" });
    submitButton.focus();
    fireEvent.keyDown(submitButton, { key: "Tab" });
    expect(document.activeElement).toBe(backButton);
    fireEvent.keyDown(backButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(submitButton);

    act(() => media.setMatches(false));
    expect(
      screen.getByRole("complementary", { name: "할 일 추가" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("textbox", { name: /할 일 제목/ })).toHaveLength(
      1,
    );
  });

  it("전체 필드를 검증하고 첫 오류 필드로 초점을 이동한다", async () => {
    const onSubmit = vi.fn();
    render(<CreationHarness onSubmit={onSubmit} />);
    const panel = openForm();

    fireEvent.click(within(panel).getByRole("button", { name: "추가" }));

    expect(
      await within(panel).findByText("할 일 제목을 입력해 주세요."),
    ).toBeTruthy();
    expect(within(panel).getByText("카테고리를 선택해 주세요.")).toBeTruthy();
    const title = within(panel).getByRole("textbox", { name: /할 일 제목/ });
    expect(document.activeElement).toBe(title);
    expect(title.getAttribute("aria-describedby")).toContain(
      "checklist-task-creation-title-error",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("공백 제목과 50자 초과를 표시하고 수정하면 오류를 갱신한다", () => {
    render(<CreationHarness onSubmit={vi.fn()} />);
    const panel = openForm();
    const title = within(panel).getByRole("textbox", { name: /할 일 제목/ });

    fireEvent.change(title, { target: { value: "   " } });
    fireEvent.blur(title);
    expect(within(panel).getByText("할 일 제목을 입력해 주세요.")).toBeTruthy();

    fireEvent.change(title, { target: { value: "가".repeat(51) } });
    expect(
      within(panel).getByText("할 일 제목은 50자 이하로 입력해 주세요."),
    ).toBeTruthy();
    expect(within(panel).getByText("51 / 50")).toBeTruthy();

    fireEvent.change(title, { target: { value: "정상 제목" } });
    expect(
      within(panel).queryByText("할 일 제목은 50자 이하로 입력해 주세요."),
    ).toBeNull();
  });

  it("네이티브 카테고리 선택기에 ViewModel 선택지를 제공한다", () => {
    render(<CreationHarness onSubmit={vi.fn()} />);
    const panel = openForm();
    const select = within(panel).getByRole("combobox", { name: /카테고리/ });

    expect(within(select).getByRole("option", { name: "예식장" })).toBeTruthy();
    expect(
      within(select).getByRole("option", { name: "청첩장·하객" }),
    ).toBeTruthy();

    fireEvent.change(select, { target: { value: "20" } });
    expect((select as HTMLSelectElement).value).toBe("20");
  });

  it("유효한 입력을 trim해 한 번 전달하고 IME 조합 중 Enter는 제출하지 않는다", async () => {
    const onSubmit = vi.fn();
    render(<CreationHarness onSubmit={onSubmit} />);
    const panel = openForm();
    const title = within(panel).getByRole("textbox", { name: /할 일 제목/ });
    fireEvent.change(title, { target: { value: "  청첩장 문구 확인  " } });
    fireEvent.change(
      within(panel).getByRole("combobox", { name: /카테고리/ }),
      { target: { value: "10" } },
    );

    fireEvent.compositionStart(title);
    expect(fireEvent.keyDown(title, { isComposing: true, key: "Enter" })).toBe(
      false,
    );
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(title);

    fireEvent.click(within(panel).getByRole("button", { name: "추가" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      categoryId: "10",
      title: "청첩장 문구 확인",
    });
  });

  it("빈 폼은 바로 닫고 dirty 폼은 폐기 확인 후 유지하거나 초기화한다", () => {
    render(<CreationHarness onSubmit={vi.fn()} />);
    let panel = openForm();
    fireEvent.click(within(panel).getByRole("button", { name: "취소" }));
    expect(
      screen.queryByRole("complementary", { name: "할 일 추가" }),
    ).toBeNull();

    panel = openForm();
    fireEvent.change(
      within(panel).getByRole("textbox", { name: /할 일 제목/ }),
      {
        target: { value: "작성 중 제목" },
      },
    );
    fireEvent.keyDown(within(panel).getByRole("textbox"), { key: "Escape" });
    const dialog = screen.getByRole("dialog", {
      name: "작성 중인 내용을 닫을까요?",
    });
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(within(dialog).getByRole("button", { name: "계속 작성" })).toBe(
      document.activeElement,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "계속 작성" }));
    expect(screen.getByDisplayValue("작성 중 제목")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "나가기",
      }),
    );
    expect(screen.queryByDisplayValue("작성 중 제목")).toBeNull();

    panel = openForm();
    expect(within(panel).getByRole("textbox").getAttribute("value")).toBe("");
  });

  it("controlled 제출 중·성공·실패 상태를 표현하고 제출 중 중복 제출과 닫기를 막는다", () => {
    const onSubmit = vi.fn();
    render(<StatefulCreationHarness onSubmit={onSubmit} />);
    const panel = openForm();

    fireEvent.click(screen.getByRole("button", { name: "제출 중 주입" }));
    expect(within(panel).getByRole("status").textContent).toBe(
      "할 일을 추가하고 있어요.",
    );
    expect(
      within(panel)
        .getByRole("button", { name: "추가 중" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      within(panel)
        .getByRole("button", { name: "할 일 추가 닫기" })
        .hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "실패 주입" }));
    expect(within(panel).getByRole("alert").textContent).toBe(
      "서버가 요청을 처리하지 못했어요.",
    );

    fireEvent.click(screen.getByRole("button", { name: "성공 주입" }));
    expect(within(panel).getByRole("status").textContent).toBe(
      "할 일을 추가했어요.",
    );
  });

  it("onSubmit 경계가 없으면 production 저장 버튼을 비활성화한다", () => {
    render(<CreationHarness />);
    const panel = openForm();

    expect(
      within(panel)
        .getByRole("button", { name: "추가" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
