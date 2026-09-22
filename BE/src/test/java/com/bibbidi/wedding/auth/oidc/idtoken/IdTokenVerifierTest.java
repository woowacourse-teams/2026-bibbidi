package com.bibbidi.wedding.auth.oidc.idtoken;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.oidc.jwks.JwksPublicKeyCache;
import com.bibbidi.wedding.auth.oidc.jwks.RsaPublicKeyFactory;
import com.bibbidi.wedding.auth.oidc.provider.OidcProviderProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.OidcTestKeys;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class IdTokenVerifierTest {

    private static final String NONCE = "nonce-value";
    private static final String KAKAO_ISSUER = "https://kauth.kakao.com";
    private static final String KAKAO_AUDIENCE = "test-kakao-client-id";
    private static final String GOOGLE_ISSUER = "https://accounts.google.com";
    private static final String GOOGLE_AUDIENCE = "test-google-client-id";

    @Mock
    private JwksPublicKeyCache jwksPublicKeyCache;

    private IdTokenVerifier idTokenVerifier;

    @BeforeEach
    void setUp() {
        idTokenVerifier = new IdTokenVerifier(
                providerProperties(),
                jwksPublicKeyCache,
                new IdTokenHeaderReader(new ObjectMapper()),
                new RsaPublicKeyFactory());
    }

    static Stream<Arguments> providers() {
        return Stream.of(
                Arguments.of(SocialProvider.KAKAO, KAKAO_ISSUER, KAKAO_AUDIENCE, "nickname", "비비디"),
                Arguments.of(SocialProvider.GOOGLE, GOOGLE_ISSUER, GOOGLE_AUDIENCE, "name", "Bibbidi"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("providers")
    @DisplayName("제공자별 설정만 다를 뿐 같은 검증을 거쳐 사용자를 확인한다")
    void shouldVerifyIdTokenOfEachProvider(
            SocialProvider provider, String issuer, String audience, String nicknameClaim, String nickname) {
        givenCachedPublicKey();
        String idToken = OidcTestKeys.idToken(issuer, audience, "social-user-1",
                Map.of("nonce", NONCE, nicknameClaim, nickname, "email", "user@bibbidi.kr"));

        SocialUserIdentity identity = idTokenVerifier.verify(provider, idToken, NONCE);

        assertThat(identity)
                .extracting(
                        SocialUserIdentity::provider,
                        SocialUserIdentity::providerUserId,
                        SocialUserIdentity::nickname,
                        SocialUserIdentity::email)
                .containsExactly(provider, "social-user-1", nickname, "user@bibbidi.kr");
    }

    @Test
    @DisplayName("설정에 없는 제공자는 거절한다")
    void shouldRejectUnconfiguredProvider() {
        OidcProviderProperties onlyKakao = new OidcProviderProperties(Map.of("kakao", kakao()));

        assertThatThrownBy(() -> onlyKakao.get(SocialProvider.GOOGLE))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.UNSUPPORTED_SOCIAL_PROVIDER);
        assertThat(onlyKakao.configuredProviders()).containsExactly(SocialProvider.KAKAO);
    }

    @Test
    @DisplayName("발급자가 다른 id_token은 거절한다")
    void shouldRejectOtherIssuer() {
        givenCachedPublicKey();
        String idToken = OidcTestKeys.idToken("https://evil.example.com", KAKAO_AUDIENCE, "social-user-1",
                Map.of("nonce", NONCE, "nickname", "비비디"));

        assertVerificationFails(idToken, NONCE);
    }

    @Test
    @DisplayName("대상이 다른 id_token은 거절한다")
    void shouldRejectOtherAudience() {
        givenCachedPublicKey();
        String idToken = OidcTestKeys.idToken(KAKAO_ISSUER, "other-client-id", "social-user-1",
                Map.of("nonce", NONCE, "nickname", "비비디"));

        assertVerificationFails(idToken, NONCE);
    }

    @Test
    @DisplayName("우리가 만든 nonce와 다르면 거절한다")
    void shouldRejectOtherNonce() {
        givenCachedPublicKey();
        String idToken = OidcTestKeys.idToken(KAKAO_ISSUER, KAKAO_AUDIENCE, "social-user-1",
                Map.of("nonce", "other-nonce", "nickname", "비비디"));

        assertVerificationFails(idToken, NONCE);
    }

    @Test
    @DisplayName("만료된 id_token은 거절한다")
    void shouldRejectExpiredIdToken() {
        givenCachedPublicKey();
        String idToken = OidcTestKeys.idToken(KAKAO_ISSUER, KAKAO_AUDIENCE, "social-user-1",
                Map.of("nonce", NONCE, "nickname", "비비디"), Instant.now().minusSeconds(10));

        assertVerificationFails(idToken, NONCE);
    }

    @Test
    @DisplayName("허용 목록에 없는 서명 알고리즘은 공개키를 찾기 전에 거절한다")
    void shouldRejectDisallowedAlgorithm() {
        OidcProviderProperties onlyEdDsa = new OidcProviderProperties(
                Map.of("kakao", kakao(List.of("EdDSA"))));
        IdTokenVerifier verifier = new IdTokenVerifier(
                onlyEdDsa, jwksPublicKeyCache, new IdTokenHeaderReader(new ObjectMapper()),
                new RsaPublicKeyFactory());
        String idToken = OidcTestKeys.idToken(KAKAO_ISSUER, KAKAO_AUDIENCE, "social-user-1",
                Map.of("nonce", NONCE, "nickname", "비비디"));

        assertThatThrownBy(() -> verifier.verify(SocialProvider.KAKAO, idToken, NONCE))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.SOCIAL_AUTHENTICATION_FAILED);
    }

    @Test
    @DisplayName("id_token 형식이 아니면 거절한다")
    void shouldRejectMalformedIdToken() {
        assertVerificationFails("not-a-token", NONCE);
    }

    private void assertVerificationFails(String idToken, String nonce) {
        assertThatThrownBy(() -> idTokenVerifier.verify(SocialProvider.KAKAO, idToken, nonce))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.SOCIAL_AUTHENTICATION_FAILED);
    }

    private void givenCachedPublicKey() {
        given(jwksPublicKeyCache.findKey(any(SocialProvider.class), anyString()))
                .willReturn(OidcTestKeys.publicJsonWebKey());
    }

    private static OidcProviderProperties providerProperties() {
        return new OidcProviderProperties(Map.of("kakao", kakao(), "google", google()));
    }

    private static OidcProviderProperties.Provider kakao() {
        return kakao(List.of("RS256"));
    }

    private static OidcProviderProperties.Provider kakao(List<String> allowedAlgorithms) {
        return new OidcProviderProperties.Provider(
                KAKAO_AUDIENCE,
                "secret",
                List.of(KAKAO_ISSUER),
                List.of(KAKAO_AUDIENCE),
                allowedAlgorithms,
                "https://kauth.kakao.com/oauth/authorize",
                "https://kauth.kakao.com/oauth/token",
                "https://kauth.kakao.com/.well-known/jwks.json",
                List.of("openid"),
                "nickname",
                "email",
                Map.of("web", "https://test.bibbidi.kr/auth/kakao", "native", "bibbidi://auth/kakao"));
    }

    private static OidcProviderProperties.Provider google() {
        return new OidcProviderProperties.Provider(
                GOOGLE_AUDIENCE,
                "secret",
                List.of(GOOGLE_ISSUER, "accounts.google.com"),
                List.of(GOOGLE_AUDIENCE),
                List.of("RS256"),
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
                "https://www.googleapis.com/oauth2/v3/certs",
                List.of("openid"),
                "name",
                "email",
                Map.of("web", "https://test.bibbidi.kr/auth/google", "native", "bibbidi://auth/google"));
    }
}
