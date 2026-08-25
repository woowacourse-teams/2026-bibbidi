import { SubmitEvent, useEffect, useRef } from "react";

import { useLoginForm } from "../view-model/useLoginForm";
import "./LoginForm.css";

const LOGIN_FORM_ERROR_ID = "login-form-error";

export function LoginForm() {
  const { formError, setFieldValue, submit, values } = useLoginForm();
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus();
    }
  }, [formError]);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
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
        <button className="login-form__submit" type="submit">
          로그인
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

      <p className="login-form__signup-prompt">
        계정이 없나요? <a href="/">회원가입</a>
      </p>
    </form>
  );
}
