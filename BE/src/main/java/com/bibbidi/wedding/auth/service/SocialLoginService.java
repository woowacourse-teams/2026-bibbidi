package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.config.OidcProviderProperties;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.OidcTokenExchangeClient;
import com.bibbidi.wedding.auth.oidc.provider.OidcAuthorizationUriFactory;
import com.bibbidi.wedding.auth.oidc.verification.IdTokenVerifier;
import com.bibbidi.wedding.auth.oidc.verification.VerifiedOidcUser;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.SocialAuthorizationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
            SocialProvider provider,
            ClientType clientType,
            SocialAuthPurpose purpose
    ) {
        return oidcAuthRequestService.start(
                provider,
                clientType,
                purpose
        );
    }

    public IssuedSession login(
            SocialProvider provider,
            ClientType clientType,
            String code,
            String state,
            @Nullable String browserBinder
    ) {
        VerifiedOidcUser identity = verifyCallback(
                provider,
                clientType,
                SocialAuthPurpose.LOGIN,
                code,
                state,
                browserBinder
        );
        return sessionIssueService.issueForNewFamily(
                socialUserRegistrationService.findOrCreate(identity),
                clientType
        );
    }

    public Long verifyForWithdrawal(
            SocialProvider provider,
            String code,
            String state,
            @Nullable String browserBinder,
            Long currentUserId
    ) {
        OidcAuthRequest request = oidcAuthRequestService.consumeForWithdrawal(
                provider,
                state,
                browserBinder
        );
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);
        String redirectUri = authorizationUriFactory.redirectUri(configuration, request.clientType());
        String idToken = tokenExchangeClient.exchangeForIdToken(
                configuration,
                code,
                request.codeVerifier(),
                redirectUri);
        VerifiedOidcUser identity = idTokenVerifier.verify(
                provider,
                idToken,
                request.nonce()
        );
        Long linkedUserId = socialUserRegistrationService.findLinkedUserId(
                identity,
                ClientError.DELETE_GRANT_INVALID
        );
        if (!linkedUserId.equals(currentUserId)) {
            throw new BusinessException(
                    ClientError.DELETE_GRANT_INVALID,
                    "탈퇴 재인증에 쓰인 소셜 계정이 지금 로그인한 회원의 것이 아닙니다."
            );
        }
        return currentUserId;
    }

    private VerifiedOidcUser verifyCallback(
            SocialProvider provider,
            ClientType clientType,
            SocialAuthPurpose purpose,
            String code,
            String state,
            @Nullable String browserBinder
    ) {
        OidcAuthRequest request = oidcAuthRequestService.consume(
                provider,
                clientType,
                purpose,
                state,
                browserBinder
        );
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);

        String redirectUri = authorizationUriFactory.redirectUri(configuration, clientType);
        String idToken = tokenExchangeClient.exchangeForIdToken(
                configuration,
                code,
                request.codeVerifier(),
                redirectUri);

        return idTokenVerifier.verify(
                provider,
                idToken,
                request.nonce()
        );
    }
}
