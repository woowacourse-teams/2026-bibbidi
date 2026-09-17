import { ReactNode, SubmitEvent } from "react";

import { SignupResult } from "../model/signup";
import { SIGNUP_FORM_GUIDANCE } from "../view-model/signupFormView";
import { useSignupForm } from "../view-model/useSignupForm";
import "./SignupForm.css";

interface SignupFormProps {
  loginLink: ReactNode;
  onSuccess?: (result: SignupResult) => void;
}

export function SignupForm({ loginLink, onSuccess }: SignupFormProps) {
  const {
    errors,
    formError,
    isFormValid,
    isSubmitting,
    isSuccess,
    nicknameMessage,
    setFieldValue,
    submit,
    validateFieldOnBlur,
    values,
  } = useSignupForm({ onSuccess });

  const isFormDisabled = isSubmitting || isSuccess;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form className="signup-form" noValidate onSubmit={handleSubmit}>
      <h1 className="signup-form__title">회원가입</h1>

      <div className="signup-form__fields">
        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="nickname">
            닉네임
          </label>
          <input
            aria-describedby="nickname-message"
            aria-invalid={Boolean(errors.nickname)}
            autoComplete="username"
            className="signup-form__input"
            disabled={isFormDisabled}
            id="nickname"
            name="nickname"
            onBlur={() => void validateFieldOnBlur("nickname")}
            onChange={(event) => setFieldValue("nickname", event.target.value)}
            placeholder="닉네임을 입력하세요"
            type="text"
            value={values.nickname}
          />
          <p
            aria-live="polite"
            className={
              errors.nickname
                ? "signup-form__message signup-form__message--error"
                : "signup-form__message"
            }
            id="nickname-message"
            role={errors.nickname ? "alert" : undefined}
          >
            {nicknameMessage}
          </p>
        </div>

        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="password">
            비밀번호
          </label>
          <input
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            autoComplete="new-password"
            className="signup-form__input"
            disabled={isFormDisabled}
            id="password"
            name="password"
            onBlur={() => void validateFieldOnBlur("password")}
            onChange={(event) => setFieldValue("password", event.target.value)}
            placeholder="비밀번호를 입력하세요"
            type="password"
            value={values.password}
          />
          <p
            className={
              errors.password
                ? "signup-form__message signup-form__message--error"
                : "signup-form__message"
            }
            id={errors.password ? "password-error" : undefined}
            role={errors.password ? "alert" : undefined}
          >
            {errors.password ?? SIGNUP_FORM_GUIDANCE.password}
          </p>
        </div>

        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="passwordConfirm">
            비밀번호 확인
          </label>
          <input
            aria-describedby={
              errors.passwordConfirm ? "password-confirm-error" : undefined
            }
            aria-invalid={Boolean(errors.passwordConfirm)}
            autoComplete="new-password"
            className="signup-form__input"
            disabled={isFormDisabled}
            id="passwordConfirm"
            name="passwordConfirm"
            onBlur={() => void validateFieldOnBlur("passwordConfirm")}
            onChange={(event) =>
              setFieldValue("passwordConfirm", event.target.value)
            }
            placeholder="비밀번호를 다시 입력하세요"
            type="password"
            value={values.passwordConfirm}
          />
          {errors.passwordConfirm && (
            <p
              className="signup-form__message signup-form__message--error"
              id="password-confirm-error"
              role="alert"
            >
              {errors.passwordConfirm}
            </p>
          )}
        </div>
      </div>

      <div className="signup-form__submit-area">
        <button
          aria-busy={isSubmitting}
          className="signup-form__submit"
          disabled={isFormDisabled || !isFormValid}
          type="submit"
        >
          {isSubmitting ? "가입 중..." : isSuccess ? "가입 완료" : "회원가입"}
        </button>
        {formError && (
          <p className="signup-form__form-error" role="alert">
            {formError}
          </p>
        )}
      </div>

      <p aria-live="polite" className="signup-form__login-prompt">
        {isSuccess ? "회원가입이 완료되었습니다. " : "이미 계정이 있나요? "}
        {loginLink}
      </p>
    </form>
  );
}
