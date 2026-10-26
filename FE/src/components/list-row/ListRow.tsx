import type { ComponentPropsWithRef, ReactNode } from "react";
import { ChevronRight } from "../icons/Chevron";
import "./ListRow.css";

export type ListRowVerticalPadding = "small" | "medium" | "large" | "xlarge";
export type ListRowHorizontalPadding = "none" | "small" | "medium";
type RowOptions = {
  left?: ReactNode;
  contents: ReactNode;
  right?: ReactNode;
  leftAlignment?: "top" | "center";
  rightAlignment?: "top" | "center";
  border?: "indented" | "none";
  verticalPadding?: ListRowVerticalPadding;
  horizontalPadding?: ListRowHorizontalPadding;
  withArrow?: boolean;
  withTouchEffect?: boolean;
  selected?: boolean;
  disabled?: boolean;
  disabledStyle?: "type1" | "type2";
};
type ActionProps = Omit<
  ComponentPropsWithRef<"button">,
  keyof RowOptions | "children" | "type" | "onClick"
> & {
  onClick: NonNullable<ComponentPropsWithRef<"button">["onClick"]>;
};
type StaticProps = Omit<
  ComponentPropsWithRef<"div">,
  keyof RowOptions | "children" | "onClick"
> & { onClick?: never };
export type ListRowProps = RowOptions & (ActionProps | StaticProps);

export type ListRowDescriptionProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "onClick" | "role"
> &
  Pick<RowOptions, "border" | "verticalPadding" | "horizontalPadding"> & {
    term: ReactNode;
    description: ReactNode;
  };

/** Render directly inside a dl to preserve native term/description pairs. */
function ListRowDescription({
  term,
  description,
  border = "indented",
  verticalPadding = "medium",
  horizontalPadding = "medium",
  className,
  ...props
}: ListRowDescriptionProps) {
  return (
    <div
      {...props}
      className={["bibbidi-list-row", className].filter(Boolean).join(" ")}
      data-border={border}
      data-vertical-padding={verticalPadding}
      data-horizontal-padding={horizontalPadding}
    >
      <dt className="bibbidi-list-row-left">{term}</dt>
      <dd className="bibbidi-list-row-contents">{description}</dd>
    </div>
  );
}

function ListRowRoot({
  left,
  contents,
  right,
  leftAlignment = "center",
  rightAlignment = "center",
  border = "indented",
  verticalPadding = "medium",
  horizontalPadding = "medium",
  withArrow = false,
  withTouchEffect = true,
  selected = false,
  disabled = false,
  disabledStyle = "type1",
  className,
  ...props
}: ListRowProps) {
  const unavailable =
    disabled ||
    props["aria-disabled"] === true ||
    props["aria-disabled"] === "true";
  const shared = {
    className: ["bibbidi-list-row", className].filter(Boolean).join(" "),
    "data-border": border,
    "data-vertical-padding": verticalPadding,
    "data-horizontal-padding": horizontalPadding,
    "data-disabled": unavailable || undefined,
    "data-disabled-style": disabledStyle,
    "data-touch-effect": (!!props.onClick && withTouchEffect) || undefined,
    "data-selected": selected || undefined,
  };
  const body = (
    <>
      {left != null && (
        <span className="bibbidi-list-row-left" data-alignment={leftAlignment}>
          {left}
        </span>
      )}
      <span className="bibbidi-list-row-contents">{contents}</span>
      {right != null && (
        <span
          className="bibbidi-list-row-right"
          data-alignment={rightAlignment}
        >
          {right}
        </span>
      )}
      {withArrow && (
        <ChevronRight
          className="bibbidi-list-row-arrow"
          size={18}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (props.onClick) {
    const { onClick, ...buttonProps } = props;
    return (
      <button
        {...buttonProps}
        {...shared}
        type="button"
        disabled={disabled}
        aria-disabled={unavailable || undefined}
        onClick={(event) => {
          if (unavailable) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick(event);
        }}
      >
        {body}
      </button>
    );
  }
  return (
    <div {...props} {...shared} aria-disabled={unavailable || undefined}>
      {body}
    </div>
  );
}

export type ListRowTextsProps = ComponentPropsWithRef<"span"> & {
  top: ReactNode;
  middle?: ReactNode;
  bottom?: ReactNode;
  align?: "left" | "right";
};
function ListRowTexts({
  top,
  middle,
  bottom,
  align = "left",
  className,
  ...props
}: ListRowTextsProps) {
  return (
    <span
      {...props}
      className={["bibbidi-list-row-texts", className]
        .filter(Boolean)
        .join(" ")}
      data-align={align}
    >
      <span className="bibbidi-list-row-text-top">{top}</span>
      {middle != null && (
        <span className="bibbidi-list-row-text-secondary">{middle}</span>
      )}
      {bottom != null && (
        <span className="bibbidi-list-row-text-secondary">{bottom}</span>
      )}
    </span>
  );
}

export type ListRowAssetProps = ComponentPropsWithRef<"span"> & {
  shape?: "original" | "squircle" | "card" | "square" | "circle";
  size?: "xsmall" | "small" | "medium";
};
function ListRowAsset({
  shape = "squircle",
  size = "small",
  className,
  children,
  ...props
}: ListRowAssetProps) {
  return (
    <span
      {...props}
      className={["bibbidi-list-row-asset", className]
        .filter(Boolean)
        .join(" ")}
      data-shape={shape}
      data-size={size}
    >
      {children}
    </span>
  );
}

export type ListRowLoaderProps = Omit<
  ComponentPropsWithRef<"div">,
  "children"
> & {
  type?: "square" | "circle" | "bar";
  verticalPadding?: ListRowVerticalPadding;
  horizontalPadding?: ListRowHorizontalPadding;
};
function ListRowLoader({
  type = "square",
  verticalPadding = "medium",
  horizontalPadding = "medium",
  className,
  "aria-label": label = "항목을 불러오는 중",
  ...props
}: ListRowLoaderProps) {
  return (
    <div
      {...props}
      className={["bibbidi-list-row", "bibbidi-list-row-loader", className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-busy="true"
      aria-label={label}
      data-vertical-padding={verticalPadding}
      data-horizontal-padding={horizontalPadding}
    >
      {type !== "bar" && (
        <span
          className="bibbidi-list-row-skeleton-asset"
          data-shape={type}
          aria-hidden="true"
        />
      )}
      <span className="bibbidi-list-row-skeleton-texts" aria-hidden="true">
        <span />
        <span />
      </span>
    </div>
  );
}

export const ListRow = Object.assign(ListRowRoot, {
  Description: ListRowDescription,
  Texts: ListRowTexts,
  Asset: ListRowAsset,
  Loader: ListRowLoader,
});
