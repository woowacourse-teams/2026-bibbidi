import { useCallback, useEffect, useRef, useState } from "react";

import { acceptWebAccessToken, refreshWebSession } from "../auth";
import { WebSessionExpiredError } from "../../infrastructure/auth/webSessionApi";
import {
  agreeToOnboardingTerms,
  changeOnboardingNickname,
  getOnboardingTerms,
  OnboardingApiError,
  OnboardingNetworkError,
  OnboardingRequestAbortedError,
  OnboardingTimeoutError,
} from "./api/onboarding";
import {
  createRequiredTermsContract,
  RequiredTermsContract,
  toOnboardingNickname,
  validateOnboardingNickname,
} from "./model/onboarding";

const TERMS_LOAD_ERROR_MESSAGE =
  "약관을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
const TERMS_CONTRACT_ERROR_MESSAGE =
  "약관 정보를 확인하지 못했어요. 다시 불러와 주세요.";
const AUTHENTICATION_ERROR_CODES = new Set([201, 204, 205, 206]);

type TermsLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; contract: RequiredTermsContract };

type SubmissionStage = "idle" | "terms" | "nickname";

interface UseOnboardingFlowOptions {
  onAuthenticationExpired: () => void;
  onSuccess: () => void;
}

export function useOnboardingFlow({
  onAuthenticationExpired,
  onSuccess,
}: UseOnboardingFlowOptions) {
  const [termsLoadState, setTermsLoadState] = useState<TermsLoadState>({
    status: "loading",
  });
  const [agreedTermIds, setAgreedTermIds] = useState<Set<number>>(new Set());
  const [expandedTermIds, setExpandedTermIds] = useState<Set<number>>(
    new Set(),
  );
  const [nickname, setNickname] = useState("");
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [nicknameError, setNicknameError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [submissionStage, setSubmissionStage] =
    useState<SubmissionStage>("idle");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const loadTermsControllerRef = useRef<AbortController | null>(null);
  const submissionControllerRef = useRef<AbortController | null>(null);
  const submissionInProgress = useRef(false);

  const loadTerms = useCallback(() => {
    loadTermsControllerRef.current?.abort();
    const controller = new AbortController();
    loadTermsControllerRef.current = controller;

    void getOnboardingTerms(controller.signal)
      .then((receivedTerms) => {
        if (controller.signal.aborted) {
          return;
        }

        const contract = createRequiredTermsContract(receivedTerms);

        if (!contract) {
          setTermsLoadState({
            status: "error",
            message: TERMS_CONTRACT_ERROR_MESSAGE,
          });
          return;
        }

        setAgreedTermIds(new Set());
        setExpandedTermIds(new Set());
        setTermsAgreed(false);
        setTermsLoadState({ status: "ready", contract });
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          error instanceof OnboardingRequestAbortedError
        ) {
          return;
        }

        setTermsLoadState({
          status: "error",
          message: TERMS_LOAD_ERROR_MESSAGE,
        });
      })
      .finally(() => {
        if (loadTermsControllerRef.current === controller) {
          loadTermsControllerRef.current = null;
        }
      });
  }, []);

  useEffect(() => {
    loadTerms();

    return () => {
      loadTermsControllerRef.current?.abort();
      submissionControllerRef.current?.abort();
    };
  }, [loadTerms]);

  const retryTermsLoad = () => {
    setTermsLoadState({ status: "loading" });
    setFormError(undefined);
    loadTerms();
  };

  const terms =
    termsLoadState.status === "ready" ? termsLoadState.contract.terms : [];
  const areAllTermsAgreed =
    terms.length > 0 && terms.every((term) => agreedTermIds.has(term.id));
  const areSomeTermsAgreed = agreedTermIds.size > 0 && !areAllTermsAgreed;

  const setAllTermsAgreement = (agreed: boolean) => {
    setAgreedTermIds(
      agreed ? new Set(terms.map((term) => term.id)) : new Set(),
    );
    setFormError(undefined);
  };

  const setTermAgreement = (termId: number, agreed: boolean) => {
    setAgreedTermIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (agreed) {
        nextIds.add(termId);
      } else {
        nextIds.delete(termId);
      }

      return nextIds;
    });
    setFormError(undefined);
  };

  const toggleTermContent = (termId: number) => {
    setExpandedTermIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(termId)) {
        nextIds.delete(termId);
      } else {
        nextIds.add(termId);
      }

      return nextIds;
    });
  };

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    setFormError(undefined);

    if (nicknameTouched) {
      setNicknameError(validateOnboardingNickname(value));
    } else {
      setNicknameError(undefined);
    }
  };

  const handleNicknameBlur = () => {
    setNicknameTouched(true);
    setNicknameError(validateOnboardingNickname(nickname));
  };

  const recoverUncertainTermsAgreement = async (
    signal: AbortSignal,
  ): Promise<boolean> => {
    try {
      const session = await refreshWebSession();

      if (signal.aborted) {
        return false;
      }

      if (session.termsAgreementRequired) {
        setFormError("약관 동의가 완료되지 않았어요. 다시 시도해 주세요.");
        return false;
      }

      return true;
    } catch (error) {
      if (signal.aborted) {
        return false;
      }

      if (error instanceof WebSessionExpiredError) {
        onAuthenticationExpired();
        return false;
      }

      setFormError(
        "약관 동의 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
      return false;
    }
  };

  const handleTermsAgreementError = (error: unknown): boolean => {
    if (!(error instanceof OnboardingApiError)) {
      setFormError("약관 동의를 처리하지 못했어요. 다시 시도해 주세요.");
      return false;
    }

    if (
      error.status === 401 ||
      AUTHENTICATION_ERROR_CODES.has(error.errorCode)
    ) {
      onAuthenticationExpired();
      return false;
    }

    if (error.errorCode === 101) {
      setTermsLoadState({
        status: "error",
        message: TERMS_CONTRACT_ERROR_MESSAGE,
      });
      return false;
    }

    if (error.errorCode === 211) {
      setFormError("약관 동의 상태를 다시 확인해 주세요.");
      return false;
    }

    setFormError("약관 동의를 처리하지 못했어요. 다시 시도해 주세요.");
    return false;
  };

  const handleNicknameError = (error: unknown) => {
    if (!(error instanceof OnboardingApiError)) {
      setFormError("닉네임을 저장하지 못했어요. 다시 시도해 주세요.");
      return;
    }

    if (
      error.status === 401 ||
      AUTHENTICATION_ERROR_CODES.has(error.errorCode)
    ) {
      onAuthenticationExpired();
      return;
    }

    if (error.errorCode === 101) {
      setNicknameError("닉네임을 다시 확인해 주세요.");
      return;
    }

    if (error.errorCode === 211) {
      setTermsAgreed(false);
      setFormError("약관 동의 상태를 다시 확인해 주세요.");
      return;
    }

    setFormError("닉네임을 저장하지 못했어요. 다시 시도해 주세요.");
  };

  const submit = async () => {
    if (submissionInProgress.current || termsLoadState.status !== "ready") {
      return;
    }

    const nextNicknameError = validateOnboardingNickname(nickname);
    setNicknameTouched(true);
    setNicknameError(nextNicknameError);

    if (nextNicknameError || !areAllTermsAgreed) {
      return;
    }

    const controller = new AbortController();
    submissionControllerRef.current = controller;
    submissionInProgress.current = true;
    setFormError(undefined);

    try {
      let canChangeNickname = termsAgreed;

      if (!canChangeNickname) {
        setSubmissionStage("terms");

        try {
          const accessToken = await agreeToOnboardingTerms(
            termsLoadState.contract.version,
            controller.signal,
          );
          acceptWebAccessToken(accessToken);
          setTermsAgreed(true);
          canChangeNickname = true;
        } catch (error) {
          if (error instanceof OnboardingRequestAbortedError) {
            return;
          }

          if (
            error instanceof OnboardingNetworkError ||
            error instanceof OnboardingTimeoutError
          ) {
            canChangeNickname = await recoverUncertainTermsAgreement(
              controller.signal,
            );

            if (canChangeNickname) {
              setTermsAgreed(true);
            }
          } else {
            canChangeNickname = handleTermsAgreementError(error);
          }
        }
      }

      if (!canChangeNickname || controller.signal.aborted) {
        return;
      }

      setSubmissionStage("nickname");

      try {
        await changeOnboardingNickname(
          toOnboardingNickname(nickname),
          controller.signal,
        );
      } catch (error) {
        if (error instanceof OnboardingRequestAbortedError) {
          return;
        }

        handleNicknameError(error);
        return;
      }

      if (!controller.signal.aborted) {
        onSuccess();
      }
    } finally {
      submissionInProgress.current = false;

      if (submissionControllerRef.current === controller) {
        submissionControllerRef.current = null;
      }

      if (!controller.signal.aborted) {
        setSubmissionStage("idle");
      }
    }
  };

  return {
    agreedTermIds,
    areAllTermsAgreed,
    areSomeTermsAgreed,
    expandedTermIds,
    formError,
    handleNicknameBlur,
    handleNicknameChange,
    isFormValid: areAllTermsAgreed && !validateOnboardingNickname(nickname),
    isSubmitting: submissionStage !== "idle",
    nickname,
    nicknameError,
    retryTermsLoad,
    setAllTermsAgreement,
    setTermAgreement,
    submissionStage,
    submit,
    termsAgreed,
    termsLoadState,
    toggleTermContent,
  };
}
