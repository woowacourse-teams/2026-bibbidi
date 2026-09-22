package com.bibbidi.wedding.auth.service.login;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.provider.OidcAuthorizationUriFactory;
import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import com.bibbidi.wedding.auth.oidc.provider.OidcSecretGenerator;
import com.bibbidi.wedding.auth.repository.OidcAuthRequestRepository;
import com.bibbidi.wedding.auth.token.OpaqueTokenGenerator;
import com.bibbidi.wedding.auth.token.SessionProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 인증을 시작할 때 서버가 만든 값을 보관하고, 돌아온 요청이 그 요청이 맞는지 확인한다.
 *
 * <p>state는 인가 주소를 타고 나갔다 돌아오므로 새어 나갈 수 있다. 그래서 웹에는 밖으로 나가지 않는
 * 값을 쿠키로 따로 심어 두고, 돌아왔을 때 시작한 브라우저가 맞는지 본다. 이것이 없으면 공격자가
 * 자기 계정으로 받은 코드를 피해자 브라우저에 제출시켜 남의 계정으로 로그인시킬 수 있다.
 */
@Service
@Transactional
public class OidcAuthRequestService {

    private final OidcProviderProperties providerProperties;
    private final OidcAuthorizationUriFactory authorizationUriFactory;
    private final OidcSecretGenerator secretGenerator;
    private final OpaqueTokenGenerator opaqueTokenGenerator;
    private final OidcAuthRequestRepository oidcAuthRequestRepository;
    private final SessionProperties sessionProperties;

    public OidcAuthRequestService(
            OidcProviderProperties providerProperties,
            OidcAuthorizationUriFactory authorizationUriFactory,
            OidcSecretGenerator secretGenerator,
            OpaqueTokenGenerator opaqueTokenGenerator,
            OidcAuthRequestRepository oidcAuthRequestRepository,
            SessionProperties sessionProperties
    ) {
        this.providerProperties = providerProperties;
        this.authorizationUriFactory = authorizationUriFactory;
        this.secretGenerator = secretGenerator;
        this.opaqueTokenGenerator = opaqueTokenGenerator;
        this.oidcAuthRequestRepository = oidcAuthRequestRepository;
        this.sessionProperties = sessionProperties;
    }

    public SocialAuthorizationResult start(
            SocialProvider provider, ClientType clientType, SocialAuthPurpose purpose) {
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);

        String state = secretGenerator.generate();
        String nonce = secretGenerator.generate();
        String codeVerifier = secretGenerator.generate();
        String browserBinder = clientType == ClientType.WEB ? secretGenerator.generate() : null;

        oidcAuthRequestRepository.save(OidcAuthRequest.start(
                opaqueTokenGenerator.hash(state),
                provider,
                nonce,
                codeVerifier,
                browserBinder == null ? null : opaqueTokenGenerator.hash(browserBinder),
                clientType,
                purpose,
                LocalDateTime.now().plus(sessionProperties.authRequestTtl())));

        String authorizationUri = authorizationUriFactory.create(
                configuration, clientType, state, nonce, secretGenerator.toCodeChallenge(codeVerifier));
        return new SocialAuthorizationResult(authorizationUri, state, browserBinder);
    }

    /** 한 번 쓴 요청은 다시 쓸 수 없다. 시작할 때와 조건이 다르면 거절한다. */
    public OidcAuthRequest consume(
            SocialProvider provider,
            ClientType clientType,
            SocialAuthPurpose purpose,
            String state,
            @Nullable String browserBinder
    ) {
        LocalDateTime now = LocalDateTime.now();
        OidcAuthRequest request = oidcAuthRequestRepository
                .findByStateHash(opaqueTokenGenerator.hash(state))
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

    private @Nullable String hashOrNull(@Nullable String browserBinder) {
        if (browserBinder == null || browserBinder.isBlank()) {
            return null;
        }
        return opaqueTokenGenerator.hash(browserBinder);
    }
}
