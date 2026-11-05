import { afterEach, describe, expect, it } from "vitest";

import { preventLinkDrag } from "./preventLinkDrag";

afterEach(() => {
  document.removeEventListener("dragstart", preventLinkDrag);
  document.body.replaceChildren();
});

describe("preventLinkDrag", () => {
  it("링크에서 시작한 드래그를 막는다", () => {
    const link = document.createElement("a");
    link.href = "/checklist";
    document.body.append(link);
    document.addEventListener("dragstart", preventLinkDrag);

    const event = new Event("dragstart", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("링크가 아닌 요소의 드래그는 건드리지 않는다", () => {
    const element = document.createElement("div");
    document.body.append(element);
    document.addEventListener("dragstart", preventLinkDrag);

    const event = new Event("dragstart", { bubbles: true, cancelable: true });
    element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
