"use client";

import { useEffect } from "react";
import { reportHandledError } from "../src/infrastructure/error-tracking";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    reportHandledError(error, {
      feature: "app",
      operation: "render",
      level: "fatal",
    });
  }, [error]);
  return (
    <html lang="ko">
      <body>
        <h1>화면을 표시하지 못했어요.</h1>
        <button type="button" onClick={reset}>
          다시 시도
        </button>
      </body>
    </html>
  );
}
