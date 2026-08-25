import { FormEvent } from "react";

import { SignupValues } from "../model/signup";
import { useSignupForm } from "../view-model/useSignupForm";
import "./SignupForm.css";

interface SignupFormProps {
  onValidSubmit?: (values: SignupValues) => void;
}

export function SignupForm({ onValidSubmit }: SignupFormProps) {
  const { errors, setFieldValue, submit, validateFieldOnBlur, values } =
    useSignupForm({ onValidSubmit });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
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
            aria-describedby={errors.nickname ? "nickname-error" : undefined}
            aria-invalid={Boolean(errors.nickname)}
            autoComplete="username"
            className="signup-form__input"
            id="nickname"
            name="nickname"
            onBlur={() => validateFieldOnBlur("nickname")}
            onChange={(event) => setFieldValue("nickname", event.target.value)}
            placeholder="닉네임을 입력하세요"
            type="text"
            value={values.nickname}
          />
          {errors.nickname && (
            <p className="signup-form__error" id="nickname-error" role="alert">
              {errors.nickname}
            </p>
          )}
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
            id="password"
            name="password"
            onBlur={() => validateFieldOnBlur("password")}
            onChange={(event) => setFieldValue("password", event.target.value)}
            placeholder="비밀번호를 입력하세요"
            type="password"
            value={values.password}
          />
          {errors.password && (
            <p className="signup-form__error" id="password-error" role="alert">
              {errors.password}
            </p>
          )}
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
            id="passwordConfirm"
            name="passwordConfirm"
            onBlur={() => validateFieldOnBlur("passwordConfirm")}
            onChange={(event) =>
              setFieldValue("passwordConfirm", event.target.value)
            }
            placeholder="비밀번호를 다시 입력하세요"
            type="password"
            value={values.passwordConfirm}
          />
          {errors.passwordConfirm && (
            <p
              className="signup-form__error"
              id="password-confirm-error"
              role="alert"
            >
              {errors.passwordConfirm}
            </p>
          )}
        </div>
      </div>

      <button className="signup-form__submit" type="submit">
        회원가입
      </button>

      <p className="signup-form__login-prompt">
        이미 계정이 있나요? <a href="/login">로그인</a>
      </p>
    </form>
  );
}
