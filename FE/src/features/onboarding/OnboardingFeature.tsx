import { FormEvent, useEffect, useRef } from "react";

import { useOnboardingFlow } from "./useOnboardingFlow";
import "./OnboardingFeature.css";

interface OnboardingFeatureProps {
  isSwitchingAccount: boolean;
  onAuthenticationExpired: () => void;
  onSuccess: () => void;
  onSwitchAccount: () => void;
  switchAccountErrorMessage: string | null;
}

interface SwitchAccountActionProps {
  disabled?: boolean;
  errorMessage: string | null;
  isSwitchingAccount: boolean;
  onSwitchAccount: () => void;
}

function SwitchAccountAction({
  disabled = false,
  errorMessage,
  isSwitchingAccount,
  onSwitchAccount,
}: SwitchAccountActionProps) {
  return (
    <div className="onboarding__switch-account">
      <button
        aria-busy={isSwitchingAccount}
        className="onboarding__switch-account-button"
        disabled={disabled || isSwitchingAccount}
        onClick={onSwitchAccount}
        type="button"
      >
        {isSwitchingAccount ? "로그인 상태 정리 중..." : "다른 계정으로 로그인"}
      </button>
      {errorMessage ? (
        <p className="onboarding__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function OnboardingFeature({
  isSwitchingAccount,
  onAuthenticationExpired,
  onSuccess,
  onSwitchAccount,
  switchAccountErrorMessage,
}: OnboardingFeatureProps) {
  const {
    agreedTermIds,
    areAllTermsAgreed,
    areSomeTermsAgreed,
    expandedTermIds,
    formError,
    handleNicknameBlur,
    handleNicknameChange,
    isFormValid,
    isSubmitting,
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
  } = useOnboardingFlow({ onAuthenticationExpired, onSuccess });
  const agreeAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (agreeAllCheckboxRef.current) {
      agreeAllCheckboxRef.current.indeterminate = areSomeTermsAgreed;
    }
  }, [areSomeTermsAgreed]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  if (termsLoadState.status === "loading") {
    return (
      <section className="onboarding" aria-labelledby="onboarding-title">
        <h1 className="onboarding__title" id="onboarding-title">
          가입 마무리
        </h1>
        <p className="onboarding__status" role="status">
          약관을 불러오고 있어요.
        </p>
        <SwitchAccountAction
          errorMessage={switchAccountErrorMessage}
          isSwitchingAccount={isSwitchingAccount}
          onSwitchAccount={onSwitchAccount}
        />
      </section>
    );
  }

  if (termsLoadState.status === "error") {
    return (
      <section className="onboarding" aria-labelledby="onboarding-title">
        <h1 className="onboarding__title" id="onboarding-title">
          가입 마무리
        </h1>
        <p className="onboarding__error" role="alert">
          {termsLoadState.message}
        </p>
        <button
          className="onboarding__retry"
          disabled={isSwitchingAccount}
          onClick={retryTermsLoad}
          type="button"
        >
          다시 시도
        </button>
        <SwitchAccountAction
          errorMessage={switchAccountErrorMessage}
          isSwitchingAccount={isSwitchingAccount}
          onSwitchAccount={onSwitchAccount}
        />
      </section>
    );
  }

  return (
    <form className="onboarding" noValidate onSubmit={handleSubmit}>
      <h1 className="onboarding__title">가입 마무리</h1>
      <p className="onboarding__description">
        필수 약관에 동의하고 사용할 닉네임을 정해 주세요.
      </p>

      <fieldset className="onboarding__terms">
        <legend className="onboarding__legend">필수 약관</legend>
        <label className="onboarding__agree-all">
          <input
            checked={areAllTermsAgreed}
            disabled={isSubmitting || termsAgreed}
            onChange={(event) => setAllTermsAgreement(event.target.checked)}
            ref={agreeAllCheckboxRef}
            type="checkbox"
          />
          전체 동의
        </label>

        <ul className="onboarding__term-list">
          {termsLoadState.contract.terms.map((term) => {
            const contentId = `onboarding-term-content-${term.id}`;
            const isExpanded = expandedTermIds.has(term.id);

            return (
              <li className="onboarding__term" key={term.id}>
                <div className="onboarding__term-summary">
                  <label className="onboarding__term-label">
                    <input
                      checked={agreedTermIds.has(term.id)}
                      disabled={isSubmitting || termsAgreed}
                      onChange={(event) =>
                        setTermAgreement(term.id, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>{term.title}</span>
                  </label>
                  <button
                    aria-controls={contentId}
                    aria-expanded={isExpanded}
                    aria-label={`${term.title} 전문 ${isExpanded ? "접기" : "보기"}`}
                    className="onboarding__term-toggle"
                    onClick={() => toggleTermContent(term.id)}
                    type="button"
                  >
                    {isExpanded ? "접기" : "보기"}
                  </button>
                </div>
                {isExpanded ? (
                  <div className="onboarding__term-content" id={contentId}>
                    {term.content}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="onboarding__field">
        <label className="onboarding__label" htmlFor="onboarding-nickname">
          닉네임
        </label>
        <input
          aria-describedby="onboarding-nickname-message"
          aria-invalid={Boolean(nicknameError)}
          autoComplete="username"
          className="onboarding__input"
          disabled={isSubmitting}
          id="onboarding-nickname"
          name="nickname"
          onBlur={handleNicknameBlur}
          onChange={(event) => handleNicknameChange(event.target.value)}
          placeholder="닉네임을 입력하세요"
          type="text"
          value={nickname}
        />
        <p
          className={
            nicknameError
              ? "onboarding__message onboarding__message--error"
              : "onboarding__message"
          }
          id="onboarding-nickname-message"
          role={nicknameError ? "alert" : undefined}
        >
          {nicknameError ?? "공백이 아닌 10자 이하로 입력해 주세요."}
        </p>
      </div>

      <div className="onboarding__submit-area">
        <button
          aria-busy={isSubmitting}
          className="onboarding__submit"
          disabled={isSubmitting || isSwitchingAccount || !isFormValid}
          type="submit"
        >
          {submissionStage === "terms"
            ? "약관 동의 중..."
            : submissionStage === "nickname"
              ? "닉네임 저장 중..."
              : "비비디 시작하기"}
        </button>
        {formError ? (
          <p className="onboarding__error" role="alert">
            {formError}
          </p>
        ) : null}
      </div>

      <SwitchAccountAction
        disabled={isSubmitting}
        errorMessage={switchAccountErrorMessage}
        isSwitchingAccount={isSwitchingAccount}
        onSwitchAccount={onSwitchAccount}
      />
    </form>
  );
}
