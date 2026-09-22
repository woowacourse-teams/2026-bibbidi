package com.bibbidi.wedding.auth.service.login;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.OidcTokenExchangeClient;
import com.bibbidi.wedding.auth.oidc.idtoken.IdTokenVerifier;
import com.bibbidi.wedding.auth.oidc.idtoken.SocialUserIdentity;
import com.bibbidi.wedding.auth.oidc.provider.OidcAuthorizationUriFactory;
import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import com.bibbidi.wedding.auth.service.session.SessionIssueService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 로그인 흐름을 이어 붙이는 자리다. 판단과 저장은 아래 서비스들이 맡고 여기서는 순서만 정한다.
 *
 * <p>인가 요청 보관과 확인은 {@link OidcAuthRequestService}가, 회원을 찾거나 만드는 일은
 * {@link SocialUserRegistrationService}가, 토큰 발급은
 * {@link SessionIssueService}가 한다.
 */
@Service
@Transactional
public class SocialLoginService {

    private final OidcAuthRequestService oidcAuthRequestService;
    private final OidcProviderProperties providerProperties;
    private final OidcAuthorizationUriFactory authorizationUriFactory;
    private final OidcTokenExchangeClient tokenExchangeClient;
    private final IdTokenVerifier idTokenVerifier;
    private final SocialUserRegistrationService socialUserRegistrationService;
    private final SessionIssueService sessionIssueService;

    public SocialLoginService(
            OidcAuthRequestService oidcAuthRequestService,
            OidcProviderProperties providerProperties,
            OidcAuthorizationUriFactory authorizationUriFactory,
            OidcTokenExchangeClient tokenExchangeClient,
            IdTokenVerifier idTokenVerifier,
            SocialUserRegistrationService socialUserRegistrationService,
            SessionIssueService sessionIssueService
    ) {
        this.oidcAuthRequestService = oidcAuthRequestService;
        this.providerProperties = providerProperties;
        this.authorizationUriFactory = authorizationUriFactory;
        this.tokenExchangeClient = tokenExchangeClient;
        this.idTokenVerifier = idTokenVerifier;
        this.socialUserRegistrationService = socialUserRegistrationService;
        this.sessionIssueService = sessionIssueService;
    }

    public SocialAuthorizationResult startAuthorization(
            SocialProvider provider, ClientType clientType, SocialAuthPurpose purpose) {
        return oidcAuthRequestService.start(provider, clientType, purpose);
    }

    public IssuedSession login(
            SocialProvider provider,
            ClientType clientType,
            String code,
            String state,
            @Nullable String browserBinder
    ) {
        SocialUserIdentity identity =
                verifyCallback(provider, clientType, SocialAuthPurpose.LOGIN, code, state, browserBinder);
        return sessionIssueService.issueForNewFamily(
                socialUserRegistrationService.findOrCreate(identity), clientType);
    }

    /** 탈퇴 직전 본인 확인이다. 지금 로그인한 회원의 소셜 계정이 맞는지만 본다. */
    public Long verifyForWithdrawal(
            SocialProvider provider,
            ClientType clientType,
            String code,
            String state,
            @Nullable String browserBinder,
            Long currentUserId
    ) {
        SocialUserIdentity identity = verifyCallback(
                provider, clientType, SocialAuthPurpose.WITHDRAWAL, code, state, browserBinder);
        Long linkedUserId = socialUserRegistrationService.findLinkedUserId(
                identity, ClientError.DELETE_GRANT_INVALID);
        if (!linkedUserId.equals(currentUserId)) {
            throw new BusinessException(ClientError.DELETE_GRANT_INVALID,
                    "탈퇴 재인증에 쓰인 소셜 계정이 지금 로그인한 회원의 것이 아닙니다.");
        }
        return currentUserId;
    }

    private SocialUserIdentity verifyCallback(
            SocialProvider provider,
            ClientType clientType,
            SocialAuthPurpose purpose,
            String code,
            String state,
            @Nullable String browserBinder
    ) {
        OidcAuthRequest request =
                oidcAuthRequestService.consume(provider, clientType, purpose, state, browserBinder);
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);

        String idToken = tokenExchangeClient.exchangeForIdToken(
                configuration,
                code,
                request.codeVerifier(),
                authorizationUriFactory.redirectUri(configuration, clientType));

        return idTokenVerifier.verify(provider, idToken, request.nonce());
    }
}
