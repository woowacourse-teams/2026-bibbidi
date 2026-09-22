package com.bibbidi.wedding.auth.service.login;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.auth.domain.SocialIdentity;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.client.OidcTokenExchangeClient;
import com.bibbidi.wedding.auth.oidc.idtoken.IdTokenVerifier;
import com.bibbidi.wedding.auth.oidc.idtoken.SocialUserIdentity;
import com.bibbidi.wedding.auth.oidc.provider.OidcAuthorizationUriFactory;
import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import com.bibbidi.wedding.auth.oidc.provider.OidcSecretGenerator;
import com.bibbidi.wedding.auth.repository.OidcAuthRequestRepository;
import com.bibbidi.wedding.auth.repository.SocialIdentityRepository;
import com.bibbidi.wedding.auth.service.session.IssuedSession;
import com.bibbidi.wedding.auth.service.session.SessionIssueService;
import com.bibbidi.wedding.auth.service.session.SessionOwner;
import com.bibbidi.wedding.auth.token.OpaqueTokenGenerator;
import com.bibbidi.wedding.auth.token.SessionProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 로그인 흐름을 맡는다.
 *
 * <p>인가 화면으로 보내기 전에 서버가 state, nonce, code_verifier를 만들어 저장하고,
 * 돌아온 요청이 그것과 맞을 때만 인가 코드를 토큰으로 바꾼다. 코드 교환은 서버에서만 한다.
 * 처음 보는 소셜 계정이면 회원을 만들되, 약관에 동의하기 전이라 아직 서비스를 쓸 수 없는 상태로 둔다.
 */
@Service
@Transactional
public class SocialLoginService {

    private final OidcProviderProperties providerProperties;
    private final OidcAuthorizationUriFactory authorizationUriFactory;
    private final OidcSecretGenerator secretGenerator;
    private final OidcTokenExchangeClient tokenExchangeClient;
    private final IdTokenVerifier idTokenVerifier;
    private final OidcAuthRequestRepository oidcAuthRequestRepository;
    private final SocialIdentityRepository socialIdentityRepository;
    private final OpaqueTokenGenerator opaqueTokenGenerator;
    private final SessionIssueService sessionIssueService;
    private final UserService userService;
    private final SessionProperties sessionProperties;

    public SocialLoginService(
            OidcProviderProperties providerProperties,
            OidcAuthorizationUriFactory authorizationUriFactory,
            OidcSecretGenerator secretGenerator,
            OidcTokenExchangeClient tokenExchangeClient,
            IdTokenVerifier idTokenVerifier,
            OidcAuthRequestRepository oidcAuthRequestRepository,
            SocialIdentityRepository socialIdentityRepository,
            OpaqueTokenGenerator opaqueTokenGenerator,
            SessionIssueService sessionIssueService,
            UserService userService,
            SessionProperties sessionProperties
    ) {
        this.providerProperties = providerProperties;
        this.authorizationUriFactory = authorizationUriFactory;
        this.secretGenerator = secretGenerator;
        this.tokenExchangeClient = tokenExchangeClient;
        this.idTokenVerifier = idTokenVerifier;
        this.oidcAuthRequestRepository = oidcAuthRequestRepository;
        this.socialIdentityRepository = socialIdentityRepository;
        this.opaqueTokenGenerator = opaqueTokenGenerator;
        this.sessionIssueService = sessionIssueService;
        this.userService = userService;
        this.sessionProperties = sessionProperties;
    }

    public SocialAuthorizationResult startAuthorization(
            SocialProvider provider, ClientType clientType, SocialAuthPurpose purpose) {
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);

        String state = secretGenerator.generate();
        String nonce = secretGenerator.generate();
        String codeVerifier = secretGenerator.generate();

        oidcAuthRequestRepository.save(OidcAuthRequest.start(
                opaqueTokenGenerator.hash(state),
                provider,
                nonce,
                codeVerifier,
                clientType,
                purpose,
                LocalDateTime.now().plus(sessionProperties.authRequestTtl())));

        String authorizationUri = authorizationUriFactory.create(
                configuration, clientType, state, nonce, secretGenerator.toCodeChallenge(codeVerifier));
        return new SocialAuthorizationResult(authorizationUri, state);
    }

    public IssuedSession login(SocialProvider provider, ClientType clientType, String code, String state) {
        SocialUserIdentity identity = verifyCallback(provider, clientType, state, SocialAuthPurpose.LOGIN, code);
        return sessionIssueService.issueForNewFamily(findOrCreateUser(identity), clientType);
    }

    /** 탈퇴 직전 본인 확인이다. 지금 로그인한 회원의 소셜 계정이 맞는지만 본다. */
    public Long verifyForWithdrawal(
            SocialProvider provider, ClientType clientType, String code, String state, Long currentUserId) {
        SocialUserIdentity identity =
                verifyCallback(provider, clientType, state, SocialAuthPurpose.WITHDRAWAL, code);
        SocialIdentity linked = socialIdentityRepository
                .findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .orElseThrow(() -> new BusinessException(ClientError.DELETE_GRANT_INVALID,
                        "탈퇴 재인증에 쓰인 소셜 계정이 회원과 연결돼 있지 않습니다."));
        if (!linked.userId().equals(currentUserId)) {
            throw new BusinessException(ClientError.DELETE_GRANT_INVALID,
                    "탈퇴 재인증에 쓰인 소셜 계정이 지금 로그인한 회원의 것이 아닙니다.");
        }
        return currentUserId;
    }

    private SocialUserIdentity verifyCallback(
            SocialProvider provider,
            ClientType clientType,
            String state,
            SocialAuthPurpose purpose,
            String code
    ) {
        OidcAuthRequest request = consumeAuthRequest(provider, clientType, purpose, state);
        OidcProviderProperties.Provider configuration = providerProperties.get(provider);

        String idToken = tokenExchangeClient.exchangeForIdToken(
                configuration,
                code,
                request.codeVerifier(),
                authorizationUriFactory.redirectUri(configuration, clientType));

        return idTokenVerifier.verify(provider, idToken, request.nonce());
    }

    private OidcAuthRequest consumeAuthRequest(
            SocialProvider provider, ClientType clientType, SocialAuthPurpose purpose, String state) {
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

        return oidcAuthRequestRepository.save(request.use(now));
    }

    private SessionOwner findOrCreateUser(SocialUserIdentity identity) {
        return socialIdentityRepository
                .findByProviderAndProviderUserId(identity.provider(), identity.providerUserId())
                .map(linked -> toOwner(userService.findCurrentUserInfo(linked.userId())))
                .orElseGet(() -> createUser(identity));
    }

    /**
     * 처음 보는 소셜 계정이다.
     * 닉네임은 제공자에서 받은 값을 그대로 쓰고, 받지 못했으면 가입을 진행하지 않는다.
     */
    private SessionOwner createUser(SocialUserIdentity identity) {
        if (identity.nickname() == null || identity.nickname().isBlank()) {
            throw new BusinessException(ClientError.SOCIAL_NICKNAME_REQUIRED,
                    "소셜 계정에서 닉네임을 받지 못해 가입을 진행할 수 없습니다. provider=" + identity.provider());
        }

        UserResult created = userService.createPendingUser(identity.nickname(), identity.email());
        socialIdentityRepository.save(
                SocialIdentity.link(created.id(), identity.provider(), identity.providerUserId()));
        return toOwner(created);
    }

    private static SessionOwner toOwner(UserResult user) {
        return new SessionOwner(user.id(), user.status(), user.role(), user.nickname(), user.email());
    }
}
