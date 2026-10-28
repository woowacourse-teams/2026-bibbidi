import type { ComponentPropsWithoutRef, MouseEvent } from "react";

type ButtonInteractionOptions = Pick<
  ComponentPropsWithoutRef<"button">,
  "disabled" | "onClick" | "aria-disabled" | "aria-busy"
> & { loading?: boolean };

/** Shared activation policy; each button owns its appearance and content. */
export function getButtonInteractionProps({
  disabled = false,
  loading = false,
  onClick,
  "aria-disabled": ariaDisabled,
  "aria-busy": ariaBusy,
}: ButtonInteractionOptions) {
  const unavailable =
    disabled || loading || ariaDisabled === true || ariaDisabled === "true";
  return {
    disabled,
    "aria-disabled": unavailable || ariaDisabled,
    "aria-busy": loading || ariaBusy,
    onClick(event: MouseEvent<HTMLButtonElement>) {
      if (unavailable) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClick?.(event);
    },
  };
}
