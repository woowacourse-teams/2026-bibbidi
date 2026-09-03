import { Outlet } from "react-router";

import { FeedbackFeature } from "../features/feedback";

export function FeedbackLayout() {
  return (
    <>
      <Outlet />
      <FeedbackFeature />
    </>
  );
}
