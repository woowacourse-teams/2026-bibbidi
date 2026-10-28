import { useEffect, useRef, useState } from "react";

import {
  MyChecklistAuthenticationRequiredError,
  useMyChecklistQueryRepository,
} from "../../checklist";

export function useAiChatChecklistRefresh(
  onAuthenticationRequired: () => void,
) {
  const query = useMyChecklistQueryRepository();
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [query],
  );

  const refresh = () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    // Refresh independently of the answer: a successful write can precede failure.
    void query
      .refresh(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const expired = cause instanceof MyChecklistAuthenticationRequiredError;
        setError(
          expired
            ? "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요."
            : "변경된 체크리스트를 불러오지 못했어요.",
        );
        if (expired) onAuthenticationRequired();
      })
      .finally(() => {
        if (request.current === controller) {
          request.current = null;
          setRefreshing(false);
        }
      });
  };
  return { refresh, error, refreshing };
}
