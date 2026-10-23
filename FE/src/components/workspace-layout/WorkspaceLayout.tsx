import type { ComponentPropsWithRef, ReactNode } from "react";
import type { WorkspaceLayoutState } from "./layout";
import "./WorkspaceLayout.css";

export type WorkspaceLayoutProps = ComponentPropsWithRef<"div"> & {
  layout: WorkspaceLayoutState;
  navigation?: ReactNode;
  aside?: ReactNode;
};

export function WorkspaceLayout({
  layout,
  navigation,
  aside,
  children,
  className,
  ...props
}: WorkspaceLayoutProps) {
  return (
    <div
      {...props}
      className={["bibbidi-workspace-layout", className]
        .filter(Boolean)
        .join(" ")}
      data-navigation={navigation ? layout.navigationPlacement : "none"}
      data-aside={aside ? layout.asidePlacement : "none"}
    >
      {navigation && (
        <div className="bibbidi-workspace-navigation">{navigation}</div>
      )}
      <div className="bibbidi-workspace-main">{children}</div>
      {aside && <div className="bibbidi-workspace-aside">{aside}</div>}
    </div>
  );
}
