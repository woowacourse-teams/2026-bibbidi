export type WorkspaceLayoutState = {
  navigationPlacement: "top" | "side";
  asidePlacement: "overlay" | "docked";
  isMobile: boolean;
};

export type WorkspaceLayoutMetrics = {
  md: number;
  lg: number;
  xl: number;
  category: number;
  detail: number;
  mainMin: number;
  gutter: number;
};

export function getWorkspaceLayout(
  viewportWidth: number,
  availableWidth: number,
  hasNavigation: boolean,
  hasAside: boolean,
  metrics: WorkspaceLayoutMetrics,
): WorkspaceLayoutState {
  const side =
    hasNavigation &&
    viewportWidth >= metrics.xl &&
    availableWidth >= metrics.category + metrics.gutter + metrics.mainMin;
  const remaining =
    availableWidth - (side ? metrics.category + metrics.gutter : 0);
  return {
    navigationPlacement: side ? "side" : "top",
    asidePlacement:
      hasAside &&
      viewportWidth >= metrics.lg &&
      remaining >= metrics.mainMin + metrics.gutter + metrics.detail
        ? "docked"
        : "overlay",
    isMobile: viewportWidth < metrics.md,
  };
}
