import { FormEvent, useEffect, useRef } from "react";

import { useAccountSetupFlow } from "./useAccountSetupFlow";
import "./AccountSetupFeature.css";

interface AccountSetupFeatureProps {
  isSwitchingAccount: boolean;
  onAuthenticationExpired: () => void;
  onSuccess: () => void;
  onSwitchAccount: () => void;
  onTermsRequired: () => void;
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
    <div className="account-setup__switch-account">
      <button
        aria-busy={isSwitchingAccount}
        className="account-setup__secondary-button"
        disabled={disabled || isSwitchingAccount}
        onClick={onSwitchAccount}
        type="button"
      >
        {isSwitchingAccount ? "로그인 상태 정리 중..." : "다른 계정으로 로그인"}
      </button>
      {errorMessage ? (
        <p className="account-setup__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function AccountSetupFeature({
  isSwitchingAccount,
  onAuthenticationExpired,
  onSuccess,
  onSwitchAccount,
  onTermsRequired,
  switchAccountErrorMessage,
}: AccountSetupFeatureProps) {
  const {
    choice,
    formError,
    handleNicknameBlur,
    handleNicknameChange,
    isNewAccountFormValid,
    isSubmitting,
    legacyValues,
    nickname,
    nicknameError,
    returnToChoice,
    selectChoice,
    setLegacyFieldValue,
    submitLegacyAccount,
    submitNewAccount,
  } = useAccountSetupFlow({
    onAuthenticationExpired,
    onSuccess,
    onTermsRequired,
  });
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus();
    }
  }, [formError]);

  const handleLegacySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitLegacyAccount();
  };

  const handleNewAccountSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitNewAccount();
  };

  if (!choice) {
    return (
      <section className="account-setup" aria-labelledby="account-setup-title">
        <h1 className="account-setup__title" id="account-setup-title">
          사용할 계정을 선택해 주세요
        </h1>
        <p className="account-setup__description">
          예전에 비비디를 사용했다면 기존 체크리스트와 일정을 이어서 볼 수
          있어요.
        </p>
        <div className="account-setup__choices">
          <button
            className="account-setup__choice"
            disabled={isSwitchingAccount}
            onClick={() => selectChoice("legacy")}
            type="button"
          >
            <strong>기존 계정 이어쓰기</strong>
            <span>예전 닉네임과 비밀번호로 데이터를 불러와요.</span>
          </button>
          <button
            className="account-setup__choice"
            disabled={isSwitchingAccount}
            onClick={() => selectChoice("new")}
            type="button"
          >
            <strong>새 계정으로 시작하기</strong>
            <span>새 닉네임을 정하고 처음부터 시작해요.</span>
          </button>
        </div>
        <SwitchAccountAction
          errorMessage={switchAccountErrorMessage}
          isSwitchingAccount={isSwitchingAccount}
          onSwitchAccount={onSwitchAccount}
        />
      </section>
    );
  }

  if (choice === "legacy") {
    return (
      <form className="account-setup" noValidate onSubmit={handleLegacySubmit}>
        <h1 className="account-setup__title">기존 계정 이어쓰기</h1>
        <p className="account-setup__description">
          예전에 로그인할 때 사용한 닉네임과 비밀번호를 입력해 주세요.
        </p>
        <div className="account-setup__fields">
          <div className="account-setup__field">
            <label className="account-setup__label" htmlFor="legacy-nickname">
              기존 닉네임
            </label>
            <input
              autoComplete="username"
              className="account-setup__input"
              disabled={isSubmitting || isSwitchingAccount}
              id="legacy-nickname"
              name="nickname"
              onChange={(event) =>
                setLegacyFieldValue("nickname", event.target.value)
              }
              type="text"
              value={legacyValues.nickname}
            />
          </div>
          <div className="account-setup__field">
            <label className="account-setup__label" htmlFor="legacy-password">
              기존 비밀번호
            </label>
            <input
              autoComplete="current-password"
              className="account-setup__input"
              disabled={isSubmitting || isSwitchingAccount}
              id="legacy-password"
              name="password"
              onChange={(event) =>
                setLegacyFieldValue("password", event.target.value)
              }
              type="password"
              value={legacyValues.password}
            />
          </div>
        </div>
        <button
          aria-busy={isSubmitting}
          className="account-setup__primary-button"
          disabled={isSubmitting || isSwitchingAccount}
          type="submit"
        >
          {isSubmitting ? "기존 계정 확인 중..." : "기존 계정 이어쓰기"}
        </button>
        {formError ? (
          <p
            className="account-setup__error"
            ref={formErrorRef}
            role="alert"
            tabIndex={-1}
          >
            {formError}
          </p>
        ) : null}
        <button
          className="account-setup__secondary-button"
          disabled={isSubmitting || isSwitchingAccount}
          onClick={returnToChoice}
          type="button"
        >
          이전 선택으로 돌아가기
        </button>
        <SwitchAccountAction
          disabled={isSubmitting}
          errorMessage={switchAccountErrorMessage}
          isSwitchingAccount={isSwitchingAccount}
          onSwitchAccount={onSwitchAccount}
        />
      </form>
    );
  }

  return (
    <form
      className="account-setup"
      noValidate
      onSubmit={handleNewAccountSubmit}
    >
      <h1 className="account-setup__title">새 계정으로 시작하기</h1>
      <p className="account-setup__description">
        새 계정은 기존 비비디 계정의 체크리스트와 일정에 연결되지 않아요.
      </p>
      <div className="account-setup__field">
        <label className="account-setup__label" htmlFor="new-nickname">
          새 닉네임
        </label>
        <input
          aria-describedby="new-nickname-message"
          aria-invalid={Boolean(nicknameError)}
          autoComplete="username"
          className="account-setup__input"
          disabled={isSubmitting || isSwitchingAccount}
          id="new-nickname"
          name="nickname"
          onBlur={handleNicknameBlur}
          onChange={(event) => handleNicknameChange(event.target.value)}
          type="text"
          value={nickname}
        />
        <p
          className={
            nicknameError
              ? "account-setup__message account-setup__message--error"
              : "account-setup__message"
          }
          id="new-nickname-message"
          role={nicknameError ? "alert" : undefined}
        >
          {nicknameError ?? "공백이 아닌 10자 이하로 입력해 주세요."}
        </p>
      </div>
      <button
        aria-busy={isSubmitting}
        className="account-setup__primary-button"
        disabled={isSubmitting || isSwitchingAccount || !isNewAccountFormValid}
        type="submit"
      >
        {isSubmitting ? "닉네임 저장 중..." : "새 계정으로 시작하기"}
      </button>
      {formError ? (
        <p
          className="account-setup__error"
          ref={formErrorRef}
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </p>
      ) : null}
      <button
        className="account-setup__secondary-button"
        disabled={isSubmitting || isSwitchingAccount}
        onClick={returnToChoice}
        type="button"
      >
        이전 선택으로 돌아가기
      </button>
      <SwitchAccountAction
        disabled={isSubmitting}
        errorMessage={switchAccountErrorMessage}
        isSwitchingAccount={isSwitchingAccount}
        onSwitchAccount={onSwitchAccount}
      />
    </form>
  );
}
