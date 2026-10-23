import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { installDialogMock } from "./dialog";
import { installPopoverMock } from "./popover";

let restoreDialog: () => void;
let restorePopover: () => void;
beforeEach(() => {
  restoreDialog = installDialogMock();
  restorePopover = installPopoverMock();
});

afterEach(() => {
  cleanup();
  restorePopover();
  restoreDialog();
});
