import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./AppLayout.css";

export type AppLayoutScroll = "document" | "contained";
export type AppLayoutHeaderPosition = "static" | "sticky";
export type AppLayoutHeaderTone = "solid" | "fade";
export type AppLayoutProps = ComponentPropsWithRef<"div"> & {
  header?: ReactNode;
  headerPosition?: AppLayoutHeaderPosition;
  headerTone?: AppLayoutHeaderTone;
  scroll?: AppLayoutScroll;
  hideScrollBar?: boolean;
};

/** The full-width product surface, outside page width and spacing constraints. */
export function AppLayout({
  header,
  headerPosition = "static",
  headerTone = "solid",
  scroll = "document",
  hideScrollBar = false,
  children,
  className,
  ref,
  ...props
}: AppLayoutProps) {
  const root = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const hasHeader = header !== undefined && header !== null && header !== false;
  useImperativeHandle(ref, () => root.current!, []);

  useLayoutEffect(() => {
    const element = root.current!;
    const headerElement = headerRef.current;
    if (!headerElement || headerPosition !== "sticky") return;
    // Include the fade area, and remeasure wrapped navigation or loaded fonts.
    const update = () =>
      element.style.setProperty(
        "--app-layout-header-height",
        `${headerElement.getBoundingClientRect().height}px`,
      );
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(headerElement);
    const view = element.ownerDocument.defaultView;
    view?.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      view?.removeEventListener("resize", update);
      element.style.removeProperty("--app-layout-header-height");
    };
  }, [hasHeader, headerPosition]);

  return (
    <div
      {...props}
      ref={root}
      className={["bibbidi-app-layout", className].filter(Boolean).join(" ")}
      data-scroll={scroll}
      data-hide-scroll-bar={hideScrollBar || undefined}
      data-header-position={hasHeader ? headerPosition : undefined}
    >
      {hasHeader && (
        <div
          ref={headerRef}
          className="bibbidi-app-layout-header"
          data-tone={headerTone}
        >
          {header}
        </div>
      )}
      {children}
    </div>
  );
}
