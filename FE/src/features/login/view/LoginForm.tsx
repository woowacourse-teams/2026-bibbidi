import { ReactNode, SubmitEvent, useEffect, useRef, useState } from "react";

import { LoginResult } from "../model/login";
import { useLoginForm } from "../view-model/useLoginForm";
import "./LoginForm.css";

const LOGIN_FORM_ERROR_ID = "login-form-error";

type SocialProvider = "kakao" | "google" | "apple";

const SOCIAL_LOGIN_PROVIDERS: Array<{
  id: SocialProvider;
  label: string;
}> = [
  { id: "kakao", label: "카카오" },
  { id: "google", label: "구글" },
  { id: "apple", label: "애플" },
];

function SocialProviderIcon({ provider }: { provider: SocialProvider }) {
  if (provider === "kakao") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.7 6.79L5.5 22l4.77-2.68c.56.08 1.14.12 1.73.12 5.52 0 10-3.58 10-8S17.52 3 12 3Z" />
      </svg>
    );
  }

  if (provider === "google") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z"
          fill="#4285f4"
        />
        <path
          d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.55c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.63A10 10 0 0 0 12 22Z"
          fill="#34a853"
        />
        <path
          d="M6.39 13.85A6 6 0 0 1 6.08 12c0-.64.11-1.27.31-1.85V7.52H3.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.05 4.48l3.34-2.63Z"
          fill="#fbbc05"
        />
        <path
          d="M12 6.02c1.47 0 2.79.5 3.83 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.34 2.63C7.18 7.78 9.39 6.02 12 6.02Z"
          fill="#ea4335"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.2.07 2.03.66 2.73.71 1.05-.21 2.06-.81 3.18-.73 1.34.11 2.35.64 3.02 1.61-2.77 1.66-2.11 5.31.43 6.33-.51 1.34-1.17 2.67-2.37 3.65l.01-.6ZM12.03 7.25C11.88 5.26 13.51 3.62 15.37 3.46c.26 2.3-2.09 4.02-3.34 3.79Z" />
    </svg>
  );
}

interface LoginFormProps {
  onSuccess?: (result: LoginResult) => void;
  signupLink: ReactNode;
}

export function LoginForm({ onSuccess, signupLink }: LoginFormProps) {
  const [socialLoginNotice, setSocialLoginNotice] = useState("");
  const {
    formError,
    formErrorRevision,
    isSubmitting,
    isSuccess,
    setFieldValue,
    submit,
    values,
  } = useLoginForm({ onSuccess });
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const isFormDisabled = isSubmitting || isSuccess;

  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus();
    }
  }, [formError, formErrorRevision]);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form className="login-form" noValidate onSubmit={handleSubmit}>
      <h1 className="login-form__title">로그인</h1>

      <div className="login-form__fields">
        <div className="login-form__field">
          <label className="login-form__label" htmlFor="login-nickname">
            닉네임
          </label>
          <input
            autoComplete="username"
            className="login-form__input"
            disabled={isFormDisabled}
            id="login-nickname"
            name="nickname"
            onChange={(event) => setFieldValue("nickname", event.target.value)}
            placeholder="닉네임을 입력하세요"
            type="text"
            value={values.nickname}
          />
        </div>

        <div className="login-form__field">
          <label className="login-form__label" htmlFor="login-password">
            비밀번호
          </label>
          <input
            autoComplete="current-password"
            className="login-form__input"
            disabled={isFormDisabled}
            id="login-password"
            name="password"
            onChange={(event) => setFieldValue("password", event.target.value)}
            placeholder="비밀번호를 입력하세요"
            type="password"
            value={values.password}
          />
        </div>
      </div>

      <div className="login-form__submit-area">
        <button
          aria-busy={isSubmitting}
          className="login-form__submit"
          disabled={isFormDisabled}
          type="submit"
        >
          {isSubmitting ? "로그인 중..." : isSuccess ? "로그인 완료" : "로그인"}
        </button>
        {formError && (
          <p
            className="login-form__form-error"
            id={LOGIN_FORM_ERROR_ID}
            ref={formErrorRef}
            role="alert"
            tabIndex={-1}
          >
            {formError}
          </p>
        )}
      </div>

      <div
        aria-label="다른 로그인 방법"
        className="login-form__divider"
        role="separator"
      >
        <span>또는</span>
      </div>

      <div className="login-form__social-buttons">
        {SOCIAL_LOGIN_PROVIDERS.map((provider) => (
          <button
            className={`login-form__social-button login-form__social-button--${provider.id}`}
            disabled={isFormDisabled}
            key={provider.id}
            onClick={() =>
              setSocialLoginNotice(`${provider.label} 로그인은 준비 중이에요.`)
            }
            type="button"
          >
            <span className="login-form__social-icon">
              <SocialProviderIcon provider={provider.id} />
            </span>
            <span>{provider.label}로 계속하기</span>
          </button>
        ))}
      </div>

      {socialLoginNotice && (
        <p className="login-form__social-notice" role="status">
          {socialLoginNotice}
        </p>
      )}

      <p className="login-form__signup-prompt">
        <span>계정이 없나요?</span>
        {signupLink}
      </p>
    </form>
  );
}
