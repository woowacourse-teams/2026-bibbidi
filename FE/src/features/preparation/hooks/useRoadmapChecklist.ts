import { useEffect, useState } from "react";
import { useAuth } from "../../auth";
import {
  useChecklistQueryRepository,
  useChecklistRevision,
} from "../../checklist/checklistQueryDependencies";
import { ChecklistQueryModel } from "../../checklist/model/checklistQuery";
import { ChecklistQueryAuthenticationRequiredError } from "../../checklist/repository/checklistQueryRepository";

type ChecklistRequest =
  | { status: "loading" | "error" | "authentication-required" }
  | { status: "success"; checklist: ChecklistQueryModel };

export function useRoadmapChecklist(enabled = true) {
  const repository = useChecklistQueryRepository();
  const revision = useChecklistRevision();
  const { authState, refreshAuth } = useAuth();
  const owner =
    authState.status === "authenticated" ? String(authState.user.id) : null;
  const [result, setResult] = useState<{
    owner: string;
    revision: number;
    request: ChecklistRequest;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled || owner === null) return;
    const controller = new AbortController();
    void repository
      .getChecklist("authenticated", controller.signal)
      .then((checklist) => {
        if (!controller.signal.aborted)
          setResult({
            owner,
            revision,
            request: { status: "success", checklist },
          });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const expired =
          error instanceof ChecklistQueryAuthenticationRequiredError;
        setResult({
          owner,
          revision,
          request: { status: expired ? "authentication-required" : "error" },
        });
        if (expired) refreshAuth();
      });
    return () => controller.abort();
  }, [repository, revision, owner, enabled, refreshAuth, retryCount]);

  const request: ChecklistRequest =
    enabled && result?.owner === owner && result.revision === revision
      ? result.request
      : { status: "loading" };
  const retry = () => {
    setResult(null);
    setRetryCount((value) => value + 1);
  };
  return { request, retry };
}
