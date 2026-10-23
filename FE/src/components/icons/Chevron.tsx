import type { ComponentProps } from "react";

type ChevronProps = ComponentProps<"svg"> & { size?: number };

function Chevron({ size = 24, children, ...props }: ChevronProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChevronDown(props: ChevronProps) {
  return (
    <Chevron {...props}>
      <path d="m6 9 6 6 6-6" />
    </Chevron>
  );
}

export function ChevronLeft(props: ChevronProps) {
  return (
    <Chevron {...props}>
      <path d="m15 18-6-6 6-6" />
    </Chevron>
  );
}

export function ChevronRight(props: ChevronProps) {
  return (
    <Chevron {...props}>
      <path d="m9 18 6-6-6-6" />
    </Chevron>
  );
}
