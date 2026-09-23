package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.provider.OidcAuthorizationUriFactory;
import com.bibbidi.wedding.auth.config.OidcProviderProperties;
import com.bibbidi.wedding.auth.repository.OidcAuthRequestRepository;
import com.bibbidi.wedding.auth.token.SecretValueGenerator;
import com.bibbidi.wedding.auth.config.SessionProperties;
import com.bibbidi.wedding.auth.service.dto.SocialAuthorizationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OidcAuthRequestService {

    private final OidcProviderProperties providerProperties;
    private final OidcAuthorizationUriFactory authorizationUriFactory;
    private final SecretValueGenerator secretValueGenerator;
    private final OidcAuthRequestRepository oidcAuthRequestRepository;
    private final SessionProperties sessionProperties;

    public OidcAuthRequestService(
            OidcProviderProperties providerProperties,
            OidcAuthorizationUriFactory authorizationUriFactory,
            SecretValueGenerator secretValueGenerator,
            OidcAuthRequestRepository oidcAuthRequestRepository,
            SessionProperties sessionProperties
    ) {
        this.providerProperties = providerProperties;
        this.authorizationUriFactory = authorizationUriFactory;
        this.secretValueGenerator = secretValueGenerator;
        this.oidcAuthRequestRepository = oidcAuthRequestRepository;
        this.sessionProperties = sessionProperties;
    }

    public SocialAuthorizationResult start(
            SocialProvider provider,
            ClientType clientType,
            SocialAuthPurpose purpose
    ) {
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);

        String state = secretValueGenerator.generate();
        String nonce = secretValueGenerator.generate();
        String codeVerifier = secretValueGenerator.generate();
        String browserBinder = clientType == ClientType.WEB ? secretValueGenerator.generate() : null;

        String stateHash = secretValueGenerator.toSha256Hex(state);
        String browserBinderHash = browserBinder == null
                ? null
                : secretValueGenerator.toSha256Hex(browserBinder);
        LocalDateTime expiresAt = LocalDateTime.now().plus(sessionProperties.authRequestLifetime());
        OidcAuthRequest authRequest = OidcAuthRequest.start(
                stateHash,
                provider,
                nonce,
                codeVerifier,
                browserBinderHash,
                clientType,
                purpose,
                expiresAt
        );
        oidcAuthRequestRepository.save(authRequest);

        String codeChallenge = secretValueGenerator.toCodeChallenge(codeVerifier);
        String authorizationUri = authorizationUriFactory.create(
                configuration,
                clientType,
                state,
                nonce,
                codeChallenge
        );
        return new SocialAuthorizationResult(
                authorizationUri,
                state,
                browserBinder
        );
    }

    public OidcAuthRequest consume(
            SocialProvider provider,
            ClientType clientType,
            SocialAuthPurpose purpose,
            String state,
            @Nullable String browserBinder
    ) {
        LocalDateTime now = LocalDateTime.now();
        OidcAuthRequest request = oidcAuthRequestRepository
                .findByStateHash(secretValueGenerator.toSha256Hex(state))
                .orElseThrow(() -> new BusinessException(ClientError.OIDC_AUTH_REQUEST_INVALID,
                        "서버가 만든 적 없는 state입니다."));

        if (!request.isUsable(now)
                || request.provider() != provider
                || request.clientType() != clientType
                || request.purpose() != purpose) {
            throw new BusinessException(ClientError.OIDC_AUTH_REQUEST_INVALID,
                    "이미 썼거나 만료됐거나 시작할 때와 조건이 다른 인가 요청입니다. requestId=" + request.id());
        }

        if (!request.matchesBrowser(hashOrNull(browserBinder))) {
            throw new BusinessException(ClientError.OIDC_AUTH_REQUEST_INVALID,
                    "인가를 시작한 브라우저가 아닙니다. requestId=" + request.id());
        }

        return oidcAuthRequestRepository.save(request.use(now));
    }

    public OidcAuthRequest consumeForWithdrawal(
            SocialProvider provider,
            String state,
            @Nullable String browserBinder
    ) {
        LocalDateTime now = LocalDateTime.now();
        OidcAuthRequest request = findByState(state);
        if (!request.isUsable(now)
                || request.provider() != provider
                || request.purpose() != SocialAuthPurpose.WITHDRAWAL) {
            throw new BusinessException(ClientError.OIDC_AUTH_REQUEST_INVALID,
                    "이미 썼거나 만료됐거나 시작할 때와 조건이 다른 인가 요청입니다. requestId=" + request.id());
        }
        if (!request.matchesBrowser(hashOrNull(browserBinder))) {
            throw new BusinessException(ClientError.OIDC_AUTH_REQUEST_INVALID,
                    "인가를 시작한 브라우저가 아닙니다. requestId=" + request.id());
        }
        return oidcAuthRequestRepository.save(request.use(now));
    }

    private OidcAuthRequest findByState(String state) {
        return oidcAuthRequestRepository
                .findByStateHash(secretValueGenerator.toSha256Hex(state))
                .orElseThrow(() -> new BusinessException(ClientError.OIDC_AUTH_REQUEST_INVALID,
                        "서버가 만든 적 없는 state입니다."));
    }

    private @Nullable String hashOrNull(@Nullable String browserBinder) {
        if (browserBinder == null || browserBinder.isBlank()) {
            return null;
        }
        return secretValueGenerator.toSha256Hex(browserBinder);
    }
}
