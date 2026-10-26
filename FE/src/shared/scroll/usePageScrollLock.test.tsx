import { useRef } from "react";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { usePageScrollLock } from "./usePageScrollLock";

function Lock({
  active = true,
  lockBody = false,
}: {
  active?: boolean;
  lockBody?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  usePageScrollLock({ rootRef, active, lockBody });
  return <div ref={rootRef} />;
}

it.each([false, true])(
  "범위 자체가 스크롤 영역인지(%s)에 관계없이 마지막 소유자가 닫힐 때 복원한다",
  (scopeIsScroll) => {
    const bodyOverflow = document.body.style.overflow;
    const layers = (first: boolean, second: boolean) => (
      <>
        {first && <Lock />}
        {second && <Lock />}
      </>
    );
    const view = (first: boolean, second: boolean) => (
      <div
        data-modal-scope
        data-page-scroll-container={scopeIsScroll || undefined}
        style={scopeIsScroll ? { overflow: "auto" } : undefined}
      >
        {scopeIsScroll ? (
          layers(first, second)
        ) : (
          <div data-page-scroll-container style={{ overflow: "auto" }}>
            {layers(first, second)}
          </div>
        )}
      </div>
    );
    const { container, rerender } = render(view(true, false));
    const scroll = container.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    )!;
    scroll.scrollTop = 300;
    rerender(view(true, true));
    rerender(view(false, true));
    expect(scroll.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe(bodyOverflow);
    rerender(view(false, false));
    expect(scroll.style.overflow).toBe("auto");
    expect(scroll.scrollTop).toBe(300);
  },
);

it("활성화한 범위와 선택한 body만 잠그고 비활성화하면 원래 값으로 돌린다", () => {
  const bodyOverflow = document.body.style.overflow;
  const view = (active: boolean) => (
    <>
      <div data-modal-scope>
        <div data-page-scroll-container style={{ overflow: "scroll" }} />
      </div>
      <div data-modal-scope>
        <div data-page-scroll-container style={{ overflow: "auto" }} />
        <Lock active={active} lockBody />
      </div>
    </>
  );
  const { container, rerender, unmount } = render(view(false));
  const [unrelated, target] = container.querySelectorAll<HTMLElement>(
    "[data-page-scroll-container]",
  );
  try {
    expect(target.style.overflow).toBe("auto");
    rerender(view(true));
    expect(unrelated.style.overflow).toBe("scroll");
    expect(target.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    rerender(view(false));
    expect(target.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe(bodyOverflow);
  } finally {
    unmount();
    document.body.style.overflow = bodyOverflow;
  }
});

it("모달 범위가 없으면 문서의 페이지 스크롤 영역을 잠근다", () => {
  const { container, unmount } = render(
    <div data-page-scroll-container style={{ overflow: "auto" }}>
      <Lock />
    </div>,
  );
  const scroll = container.firstElementChild as HTMLElement;
  expect(scroll.style.overflow).toBe("hidden");
  unmount();
  expect(scroll.style.overflow).toBe("auto");
});
