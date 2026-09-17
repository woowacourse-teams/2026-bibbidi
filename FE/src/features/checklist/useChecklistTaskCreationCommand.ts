import { useCallback, useEffect, useRef, useState } from "react";

import { analytics } from "../../infrastructure/analytics";
import { createChecklistTaskCreateEvent } from "./analytics/checklistAnalytics";
import { ChecklistAudience } from "./model/checklistQuery";
import {
  CustomChecklistItemCreationError,
  MyChecklistCommandRepository,
} from "./repository/myChecklistCommandRepository";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
} from "./repository/myChecklistQueryRepository";
import {
  ChecklistTaskCreationInput,
  ChecklistTaskCreationSubmissionState,
} from "./useChecklistTaskCreation";

const idleSubmissionState: ChecklistTaskCreationSubmissionState = {
  status: "idle",
};

export interface ChecklistTaskCreationCommandController {
  submissionState: ChecklistTaskCreationSubmissionState;
  submit: (input: ChecklistTaskCreationInput) => Promise<boolean>;
}

export function useChecklistTaskCreationCommand(
  commandRepository: MyChecklistCommandRepository,
  refreshAuth: () => void,
  audience: ChecklistAudience | undefined,
  sessionIdentity?: string,
): ChecklistTaskCreationCommandController {
  const [submissionState, setSubmissionState] =
    useState<ChecklistTaskCreationSubmissionState>(idleSubmissionState);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const requestGenerationRef = useRef(0);
  const didCancelForRepositoryChangeRef = useRef(false);
  const currentSessionIdentity =
    sessionIdentity ?? (audience === "guest" ? "guest" : undefined);
  const previousSessionIdentityRef = useRef(currentSessionIdentity);
  const requestContextRef = useRef({ audience, commandRepository });

  useEffect(() => {
    requestContextRef.current = { audience, commandRepository };
  }, [audience, commandRepository]);

  useEffect(() => {
    let isActive = true;

    if (didCancelForRepositoryChangeRef.current) {
      didCancelForRepositoryChangeRef.current = false;
      queueMicrotask(() => {
        if (isActive) {
          setSubmissionState(idleSubmissionState);
        }
      });
    }

    return () => {
      isActive = false;
      requestGenerationRef.current += 1;
      didCancelForRepositoryChangeRef.current =
        controllerRef.current !== undefined;
      controllerRef.current?.abort();
      controllerRef.current = undefined;
    };
  }, [commandRepository]);

  useEffect(() => {
    if (
      currentSessionIdentity === undefined ||
      previousSessionIdentityRef.current === currentSessionIdentity
    ) {
      return;
    }

    previousSessionIdentityRef.current = currentSessionIdentity;
    requestGenerationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    let isActive = true;

    queueMicrotask(() => {
      if (isActive) {
        setSubmissionState(idleSubmissionState);
      }
    });

    return () => {
      isActive = false;
    };
  }, [currentSessionIdentity]);

  const submit = useCallback(
    async (input: ChecklistTaskCreationInput): Promise<boolean> => {
      if (audience !== "authenticated" || controllerRef.current) {
        return false;
      }

      const controller = new AbortController();
      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      controllerRef.current = controller;
      setSubmissionState({ status: "submitting" });

      try {
        await commandRepository.createCustomItem(
          input.title,
          input.categoryId,
          controller.signal,
        );

        const currentContext = requestContextRef.current;

        if (requestGenerationRef.current !== requestGeneration) {
          return false;
        }

        if (
          currentContext.audience !== "authenticated" ||
          currentContext.commandRepository !== commandRepository
        ) {
          setSubmissionState(idleSubmissionState);
          return false;
        }

        setSubmissionState(idleSubmissionState);
        analytics.track(createChecklistTaskCreateEvent(input.categoryId));
        return true;
      } catch (error) {
        if (requestGenerationRef.current !== requestGeneration) {
          return false;
        }

        if (
          controller.signal.aborted ||
          error instanceof MyChecklistRequestAbortedError
        ) {
          setSubmissionState(idleSubmissionState);
          return false;
        }

        if (error instanceof MyChecklistAuthenticationRequiredError) {
          refreshAuth();
          setSubmissionState({ message: error.message, status: "error" });
          return false;
        }

        setSubmissionState({
          message:
            error instanceof CustomChecklistItemCreationError
              ? error.message
              : "할 일을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.",
          status: "error",
        });
        return false;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = undefined;
        }
      }
    },
    [audience, commandRepository, refreshAuth],
  );

  return { submissionState, submit };
}
