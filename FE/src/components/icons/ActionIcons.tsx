import { IconBase, type IconProps } from "./IconBase";

type ActionIconProps = IconProps;

export function HamburgerIcon(props: ActionIconProps) {
  return (
    <IconBase strokeWidth={1.8} aria-hidden="true" focusable="false" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </IconBase>
  );
}

export function CloseIcon(props: ActionIconProps) {
  return (
    <IconBase strokeWidth={1.8} aria-hidden="true" focusable="false" {...props}>
      <path d="m6 6 12 12M6 18 18 6" />
    </IconBase>
  );
}

export function LogoutIcon(props: ActionIconProps) {
  return (
    <IconBase strokeWidth={1.8} aria-hidden="true" focusable="false" {...props}>
      <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" />
    </IconBase>
  );
}

export function RetryIcon(props: ActionIconProps) {
  return (
    <IconBase strokeWidth={1.8} aria-hidden="true" focusable="false" {...props}>
      <path d="M20 11a8 8 0 1 0-2.34 6.66M20 4v7h-7" />
    </IconBase>
  );
}

export function CheckIcon(props: ActionIconProps) {
  return (
    <IconBase aria-hidden="true" focusable="false" {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  );
}
