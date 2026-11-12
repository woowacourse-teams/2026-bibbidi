import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth";
import {
  MyChecklistAuthenticationRequiredError,
  useMyChecklistQueryRepository,
  useMyChecklistRevision,
} from "../../checklist";
import type {
  ReadyRoadmapPersonalState,
  RoadmapPersonalState,
} from "../model/roadmapPersonalState";
import { usePreparationChecklistRepository } from "../preparationDependencies";

export function useRoadmapChecklist() {
  const repository = useMyChecklistQueryRepository();
  const checklistRepository = usePreparationChecklistRepository();
  const checklistRevision = useMyChecklistRevision();
  const { authState, refreshAuth } = useAuth();
  const audience =
    authState.status === "authenticated" || authState.status === "guest"
      ? authState.status
      : undefined;
  const revision = audience === "authenticated" ? checklistRevision : 0;
  const owner =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.id}`
      : authState.status;
  const scope = useMemo(() => ({ owner, repository }), [owner, repository]);
  const [result, setResult] = useState<{
    scope: typeof scope;
    request: ReadyRoadmapPersonalState | { status: "error" };
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  if (result && result.scope !== scope) setResult(null);

  useEffect(() => {
    if (!audience) return;

    const controller = new AbortController();
    const request: Promise<ReadyRoadmapPersonalState> =
      audience === "guest"
        ? checklistRepository
            .getCatalogItemIds("guest", controller.signal)
            .then((catalogItemIds) => ({
              status: "ready",
              audience: "guest",
              catalogItemIds,
            }))
        : scope.repository
            .getChecklist(controller.signal)
            .then(({ items }) => ({
              status: "ready",
              audience: "authenticated",
              items,
            }));

    void request.then(
      (request) => {
        if (!controller.signal.aborted) setResult({ scope, request });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ scope, request: { status: "error" } });
        if (error instanceof MyChecklistAuthenticationRequiredError)
          refreshAuth();
      },
    );

    return () => controller.abort();
  }, [audience, checklistRepository, refreshAuth, retryCount, scope, revision]);

  const personal: RoadmapPersonalState =
    authState.status === "error"
      ? { status: "error" }
      : !audience
        ? { status: "unknown" }
        : result?.scope === scope
          ? result.request
          : { status: "loading" };

  const retry = () => {
    if (authState.status === "error") {
      refreshAuth();
      return;
    }
    setResult(null);
    setRetryCount((value) => value + 1);
  };

  const recordGuestAdditions = (ids: readonly string[]) => {
    setResult((current) => {
      if (
        current?.scope !== scope ||
        current.request.status !== "ready" ||
        current.request.audience !== "guest"
      )
        return current;

      return {
        scope,
        request: {
          ...current.request,
          catalogItemIds: [
            ...new Set([...current.request.catalogItemIds, ...ids]),
          ],
        },
      };
    });
  };

  return { checklistRepository, personal, recordGuestAdditions, retry, scope };
}
