import type { ComponentPropsWithRef } from "react";
import "./PageContainer.css";

export type PageContainerWidth = "content" | "wide" | "focus" | "auth";
export type PageContainerProps = ComponentPropsWithRef<"div"> & {
  width?: PageContainerWidth;
};

/** A page's maximum content width, excluding its responsive outer margins. */
export function PageContainer({
  width = "content",
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      {...props}
      className={["bibbidi-page-container", className]
        .filter(Boolean)
        .join(" ")}
      data-width={width}
    />
  );
}
