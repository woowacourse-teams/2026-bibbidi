import { useEffect, useState } from "react";

import { startSocialAuthorization } from "../api/socialLogin";
import { isConnectedSocialProvider } from "../model/socialLogin";
import "./SocialLoginForm.css";

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

export function SocialLoginForm() {
  const [socialLoginNotice, setSocialLoginNotice] = useState("");
  const [isSocialRedirecting, setIsSocialRedirecting] = useState(false);

  useEffect(() => {
    const resetSocialRedirectState = () => {
      setIsSocialRedirecting(false);
      setSocialLoginNotice("");
    };

    window.addEventListener("pageshow", resetSocialRedirectState);
    return () =>
      window.removeEventListener("pageshow", resetSocialRedirectState);
  }, []);

  const handleSocialLogin = (provider: {
    id: SocialProvider;
    label: string;
  }) => {
    if (!isConnectedSocialProvider(provider.id)) {
      setSocialLoginNotice(`${provider.label} 로그인은 준비 중이에요.`);
      return;
    }

    setIsSocialRedirecting(true);
    setSocialLoginNotice(`${provider.label} 로그인 화면으로 이동하고 있어요.`);
    startSocialAuthorization(provider.id)
      .then((authorizationUri) => window.location.assign(authorizationUri))
      .catch(() => {
        setIsSocialRedirecting(false);
        setSocialLoginNotice(
          `${provider.label} 로그인을 시작하지 못했어요. 다시 시도해 주세요.`,
        );
      });
  };

  return (
    <section aria-labelledby="social-login-title" className="social-login-form">
      <h1 className="social-login-form__title" id="social-login-title">
        로그인
      </h1>

      <div className="social-login-form__buttons">
        {SOCIAL_LOGIN_PROVIDERS.map((provider) => (
          <button
            className={`social-login-form__button social-login-form__button--${provider.id}`}
            disabled={isSocialRedirecting}
            key={provider.id}
            onClick={() => handleSocialLogin(provider)}
            type="button"
          >
            <span className="social-login-form__icon">
              <SocialProviderIcon provider={provider.id} />
            </span>
            <span>{provider.label}로 계속하기</span>
          </button>
        ))}
      </div>

      <aside
        aria-labelledby="legacy-account-guide-title"
        className="social-login-form__account-guide"
      >
        <span aria-hidden="true" className="social-login-form__guide-icon">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M9.5 14.5 14.5 9.5M7.25 16.75l-1 1a3.54 3.54 0 0 1-5-5l3.5-3.5a3.54 3.54 0 0 1 5 0M16.75 7.25l1-1a3.54 3.54 0 0 1 5 5l-3.5 3.5a3.54 3.54 0 0 1-5 0" />
          </svg>
        </span>
        <span className="social-login-form__guide-copy">
          <strong id="legacy-account-guide-title">
            기존 계정이 있으신가요?
          </strong>
          <span>소셜 로그인을 진행하면 기존 계정과 연동할 수 있어요.</span>
        </span>
      </aside>

      {socialLoginNotice && (
        <p className="social-login-form__notice" role="status">
          {socialLoginNotice}
        </p>
      )}
    </section>
  );
}
