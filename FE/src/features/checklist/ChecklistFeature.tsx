import { useEffect, useState } from "react";

import { useAuth } from "../auth";
import { useChecklistQueryRepository } from "./checklistQueryDependencies";
import { ChecklistAudience, ChecklistQueryModel } from "./model/checklistQuery";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRequestAbortedError,
} from "./repository/checklistQueryRepository";
import { createChecklistViewModel } from "./view-model/createChecklistViewModel";
import { Checklist } from "./view/Checklist";
import { ChecklistState } from "./view/ChecklistState";

type ChecklistRequestState =
  | { audience?: ChecklistAudience; status: "loading" }
  | { audience: ChecklistAudience; status: "empty" }
  | { audience: ChecklistAudience; status: "authentication-required" }
  | { audience: ChecklistAudience; status: "error" }
  | {
      audience: ChecklistAudience;
      checklist: ChecklistQueryModel;
      status: "success";
    };

function isRequestAborted(error: unknown): boolean {
  return error instanceof ChecklistQueryRequestAbortedError;
}

export function ChecklistFeature() {
  const { authState, refreshAuth } = useAuth();
  const checklistRepository = useChecklistQueryRepository();
  const [requestState, setRequestState] = useState<ChecklistRequestState>({
    status: "loading",
  });
  const [requestRevision, setRequestRevision] = useState(0);
  const audience: ChecklistAudience | undefined =
    authState.status === "authenticated"
      ? "authenticated"
      : authState.status === "guest"
        ? "guest"
        : undefined;

  useEffect(() => {
    if (!audience) {
      return;
    }

    const controller = new AbortController();
    let ignoresResult = false;

    void checklistRepository
      .getChecklist(audience, controller.signal)
      .then((checklist) => {
        if (ignoresResult) {
          return;
        }

        if (checklist.categories.length === 0) {
          setRequestState({ audience, status: "empty" });
          return;
        }

        setRequestState({ audience, checklist, status: "success" });
      })
      .catch((error: unknown) => {
        if (
          ignoresResult ||
          controller.signal.aborted ||
          isRequestAborted(error)
        ) {
          return;
        }

        const requiresAuthentication =
          error instanceof ChecklistQueryAuthenticationRequiredError;

        if (requiresAuthentication) {
          refreshAuth();
        }

        setRequestState({
          audience,
          status: requiresAuthentication ? "authentication-required" : "error",
        });
      });

    return () => {
      ignoresResult = true;
      controller.abort();
    };
  }, [audience, checklistRepository, refreshAuth, requestRevision]);

  const handleRetry = () => {
    if (!audience) {
      refreshAuth();
      return;
    }

    setRequestState({ audience, status: "loading" });
    setRequestRevision((revision) => revision + 1);
  };

  if (!audience) {
    return (
      <ChecklistState
        onRetry={
          requestState.status === "authentication-required"
            ? handleRetry
            : undefined
        }
        status={
          requestState.status === "authentication-required"
            ? "authentication-required"
            : "loading"
        }
      />
    );
  }

  if (requestState.audience !== audience) {
    return <ChecklistState status="loading" />;
  }

  if (
    requestState.status === "authentication-required" ||
    requestState.status === "error"
  ) {
    return (
      <ChecklistState onRetry={handleRetry} status={requestState.status} />
    );
  }

  if (requestState.status !== "success") {
    return <ChecklistState status={requestState.status} />;
  }

  return (
    <Checklist categories={createChecklistViewModel(requestState.checklist)} />
  );
}
