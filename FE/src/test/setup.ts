import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
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

// Component tests run the same navigation contract against an in-memory history.
vi.mock("next/link", async () => ({
  default: (await import("./NextLinkStub")).NextLinkStub,
}));
