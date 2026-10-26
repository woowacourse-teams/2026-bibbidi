import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ListRow } from "./ListRow";

it("설명 행은 dl 아래에 네이티브 항목·값 쌍을 만들고 값의 컨트롤을 조작할 수 있다", () => {
  const onChange = vi.fn();
  render(
    <dl>
      <ListRow.Description
        term="상태"
        description={<button onClick={onChange}>상태 변경</button>}
      />
    </dl>,
  );

  const control = screen.getByRole("button", { name: "상태 변경" });
  const definition = control.parentElement;
  const row = definition?.parentElement;
  expect(definition?.tagName).toBe("DD");
  expect(row?.parentElement?.tagName).toBe("DL");
  expect(Array.from(row?.children ?? []).map((child) => child.tagName)).toEqual(
    ["DT", "DD"],
  );
  expect(row?.firstElementChild?.textContent).toBe("상태");

  fireEvent.click(control);
  expect(onChange).toHaveBeenCalledOnce();
});
