import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { ChevronLeft } from "../icons/Chevron";
import { CloseIcon } from "../icons/ActionIcons";
import { IconButton } from "../icon-button";
import type { IconButtonProps } from "../icon-button";
import "./TopNavigation.css";

export type TopNavigationVariant = "root" | "standard";
export type TopNavigationTitleAlign = "start" | "center";
export type TopNavigationProps = Omit<
  ComponentPropsWithRef<"header">,
  "title" | "children" | "prefix"
> & {
  title: ReactNode;
  subtitle?: string;
  variant?: TopNavigationVariant;
  leading?: ReactNode;
  actions?: ReactNode;
  titleAlign?: TopNavigationTitleAlign;
  headingLevel?: 1 | 2 | 3 | "none";
  sticky?: boolean;
  /** Apply only when this header owns the viewport's top safe area. */
  safeArea?: boolean;
  divider?: boolean;
};

function Root({
  title,
  subtitle,
  variant = "standard",
  leading,
  actions,
  titleAlign = variant === "root" ? "start" : "center",
  headingLevel = 1,
  sticky = true,
  safeArea = false,
  divider = false,
  className,
  style,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  ...props
}: TopNavigationProps) {
  const id = useId();
  const leadingRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [sideWidth, setSideWidth] = useState(0);
  // Equal side tracks keep the title centered even with two actions on one side.
  useLayoutEffect(() => {
    if (titleAlign !== "center") return;
    const measure = () =>
      setSideWidth(
        Math.ceil(
          Math.max(
            leadingRef.current?.getBoundingClientRect().width ?? 0,
            actionsRef.current?.getBoundingClientRect().width ?? 0,
          ),
        ),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(leadingRef.current!);
    observer.observe(actionsRef.current!);
    return () => observer.disconnect();
  }, [titleAlign]);
  const Heading =
    headingLevel === "none"
      ? "div"
      : (`h${headingLevel}` as "h1" | "h2" | "h3");
  const hasSubtitle = subtitle != null && subtitle !== "";
  const variables = {
    ...style,
    "--top-navigation-side-width": `${sideWidth}px`,
  } as CSSProperties;
  return (
    <header
      {...props}
      className={["bibbidi-top-navigation", className]
        .filter(Boolean)
        .join(" ")}
      style={variables}
      data-variant={variant}
      data-align={titleAlign}
      data-sticky={sticky || undefined}
      data-safe-area={safeArea || undefined}
      data-divider={divider || undefined}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy ?? (ariaLabel ? undefined : `${id}-title`)}
    >
      <div className="bibbidi-top-navigation-bar">
        <div className="bibbidi-top-navigation-leading" ref={leadingRef}>
          {leading}
        </div>
        <div className="bibbidi-top-navigation-main">
          <Heading
            className="bibbidi-top-navigation-title"
            id={`${id}-title`}
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </Heading>
          {hasSubtitle && (
            <p className="bibbidi-top-navigation-subtitle" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="bibbidi-top-navigation-actions" ref={actionsRef}>
          {actions}
        </div>
      </div>
    </header>
  );
}

export type TopNavigationIconButtonProps = Omit<IconButtonProps, "iconSize">;
function ActionIconButton({
  color = "currentColor",
  ...props
}: TopNavigationIconButtonProps) {
  return <IconButton {...props} iconSize={24} color={color} />;
}
export type TopNavigationBackButtonProps = Omit<
  TopNavigationIconButtonProps,
  "icon" | "aria-label"
> & { "aria-label"?: string };
function BackButton({
  "aria-label": label = "뒤로가기",
  ...props
}: TopNavigationBackButtonProps) {
  return (
    <ActionIconButton {...props} aria-label={label} icon={<ChevronLeft />} />
  );
}
export type TopNavigationCloseButtonProps = TopNavigationBackButtonProps;
function CloseButton({
  "aria-label": label = "닫기",
  ...props
}: TopNavigationCloseButtonProps) {
  return (
    <ActionIconButton {...props} aria-label={label} icon={<CloseIcon />} />
  );
}
export const TopNavigation = Object.assign(Root, {
  BackButton,
  CloseButton,
  IconButton: ActionIconButton,
});
