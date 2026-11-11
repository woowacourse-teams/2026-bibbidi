import { useContext, type ComponentProps } from "react";
import type NextLink from "next/link";
import { NavigationContext } from "../app/navigation/navigationContext";

export function NextLinkStub({
  href,
  children,
  onNavigate,
  onClick,
  replace,
  scroll,
  ...props
}: ComponentProps<typeof NextLink>) {
  const navigate = useContext(NavigationContext)?.navigate;
  if (typeof href !== "string")
    throw new Error("테스트 링크에는 문자열 URL이 필요합니다.");
  const testHref = href.replace(/([^/])\/(?=[?#]|$)/, "$1");
  return (
    <a
      {...props}
      href={testHref}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey ||
          (props.target && props.target !== "_self")
        )
          return;
        event.preventDefault();
        let intercepted = false;
        onNavigate?.({
          preventDefault: () => {
            intercepted = true;
          },
        });
        if (!intercepted)
          navigate?.(testHref, { replace, preventScrollReset: !scroll });
      }}
    >
      {children}
    </a>
  );
}
