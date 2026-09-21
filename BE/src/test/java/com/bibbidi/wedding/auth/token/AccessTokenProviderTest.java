package com.bibbidi.wedding.auth.token;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.JwtTestKeys;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.security.KeyPair;
import java.security.PrivateKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import javax.crypto.SecretKey;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AccessTokenProviderTest {

    private static final String ISSUER = "https://api.bibbidi.kr";
    private static final String AUDIENCE = "bibbidi-api";
    private static final Long USER_ID = 7L;
    private static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(30);

    private AccessTokenProvider accessTokenProvider;

    @BeforeEach
    void setUp() {
        JwtProperties jwtProperties = new JwtProperties(
                ISSUER,
                AUDIENCE,
                ACCESS_TOKEN_TTL,
                Duration.ofDays(30),
                JwtTestKeys.ACTIVE_KEY_ID,
                JwtTestKeys.encodedPrivateKey(),
                List.of()
        );
        accessTokenProvider = new AccessTokenProvider(jwtProperties, new JwtKeySource(jwtProperties));
    }

    @Test
    @DisplayName("발급한 Access Token에서 사용자 ID를 읽는다")
    void shouldReadUserIdFromIssuedToken() {
        String accessToken = accessTokenProvider.issue(USER_ID, Instant.now());

        assertThat(accessTokenProvider.parseUserId(accessToken)).isEqualTo(USER_ID);
    }

    @Test
    @DisplayName("만료된 Access Token은 거절한다")
    void shouldRejectExpiredToken() {
        Instant issuedLongAgo = Instant.now().minus(ACCESS_TOKEN_TTL).minusSeconds(60);
        String expiredToken = accessTokenProvider.issue(USER_ID, issuedLongAgo);

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(expiredToken));
    }

    @Test
    @DisplayName("만료 시각이 없는 Access Token은 거절한다")
    void shouldRejectTokenWithoutExpiration() {
        String tokenWithoutExpiration = Jwts.builder()
                .header()
                .keyId(JwtTestKeys.ACTIVE_KEY_ID)
                .and()
                .issuer(ISSUER)
                .audience()
                .add(AUDIENCE)
                .and()
                .subject(String.valueOf(USER_ID))
                .claim("category", TokenCategory.ACCESS.claimValue())
                .signWith(JwtTestKeys.privateKey(), Jwts.SIG.RS256)
                .compact();

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(tokenWithoutExpiration));
    }

    @Test
    @DisplayName("다른 키로 서명한 Access Token은 거절한다")
    void shouldRejectTokenSignedWithAnotherKey() {
        KeyPair anotherKeyPair = JwtTestKeys.generateAnotherKeyPair();
        String forgedToken = signWithRsa(anotherKeyPair.getPrivate(), JwtTestKeys.ACTIVE_KEY_ID);

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(forgedToken));
    }

    @Test
    @DisplayName("HS256으로 알고리즘을 바꾼 Access Token은 거절한다")
    void shouldRejectTokenSignedWithHmac() {
        SecretKey secretKey = Keys.hmacShaKeyFor("bibbidi-test-secret-key-for-hs256-algorithm".getBytes());
        String hmacToken = Jwts.builder()
                .header()
                .keyId(JwtTestKeys.ACTIVE_KEY_ID)
                .and()
                .issuer(ISSUER)
                .audience()
                .add(AUDIENCE)
                .and()
                .subject(String.valueOf(USER_ID))
                .claim("category", TokenCategory.ACCESS.claimValue())
                .expiration(Date.from(Instant.now().plus(ACCESS_TOKEN_TTL)))
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(hmacToken));
    }

    @Test
    @DisplayName("서명을 뗀 alg=none Access Token은 거절한다")
    void shouldRejectUnsecuredToken() {
        String unsecuredToken = Jwts.builder()
                .header()
                .keyId(JwtTestKeys.ACTIVE_KEY_ID)
                .and()
                .issuer(ISSUER)
                .audience()
                .add(AUDIENCE)
                .and()
                .subject(String.valueOf(USER_ID))
                .claim("category", TokenCategory.ACCESS.claimValue())
                .expiration(Date.from(Instant.now().plus(ACCESS_TOKEN_TTL)))
                .compact();

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(unsecuredToken));
    }

    @Test
    @DisplayName("모르는 kid가 적힌 Access Token은 거절한다")
    void shouldRejectUnknownKeyId() {
        String unknownKeyIdToken = signWithRsa(JwtTestKeys.privateKey(), "unknown-key");

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(unknownKeyIdToken));
    }

    @Test
    @DisplayName("Access Token 자리에 Refresh 용도의 토큰이 오면 거절한다")
    void shouldRejectRefreshCategoryToken() {
        String refreshCategoryToken = signWithRsa(
                JwtTestKeys.privateKey(),
                JwtTestKeys.ACTIVE_KEY_ID,
                ISSUER,
                AUDIENCE,
                TokenCategory.REFRESH.claimValue()
        );

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(refreshCategoryToken));
    }

    @Test
    @DisplayName("발급자가 다른 Access Token은 거절한다")
    void shouldRejectDifferentIssuer() {
        String otherIssuerToken = signWithRsa(
                JwtTestKeys.privateKey(),
                JwtTestKeys.ACTIVE_KEY_ID,
                "https://evil.example.com",
                AUDIENCE,
                TokenCategory.ACCESS.claimValue()
        );

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(otherIssuerToken));
    }

    @Test
    @DisplayName("대상자가 다른 Access Token은 거절한다")
    void shouldRejectDifferentAudience() {
        String otherAudienceToken = signWithRsa(
                JwtTestKeys.privateKey(),
                JwtTestKeys.ACTIVE_KEY_ID,
                ISSUER,
                "other-service",
                TokenCategory.ACCESS.claimValue()
        );

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(otherAudienceToken));
    }

    @Test
    @DisplayName("사용자 ID가 양수가 아닌 Access Token은 거절한다")
    void shouldRejectNonPositiveUserId() {
        String nonPositiveSubjectToken = Jwts.builder()
                .header()
                .keyId(JwtTestKeys.ACTIVE_KEY_ID)
                .and()
                .issuer(ISSUER)
                .audience()
                .add(AUDIENCE)
                .and()
                .subject("0")
                .claim("category", TokenCategory.ACCESS.claimValue())
                .expiration(Date.from(Instant.now().plus(ACCESS_TOKEN_TTL)))
                .signWith(JwtTestKeys.privateKey(), Jwts.SIG.RS256)
                .compact();

        assertAuthenticationFailed(() -> accessTokenProvider.parseUserId(nonPositiveSubjectToken));
    }

    @Test
    @DisplayName("검증 실패 메시지에 토큰 값을 남기지 않는다")
    void shouldNotExposeTokenValueInFailureMessage() {
        String forgedToken = signWithRsa(JwtTestKeys.generateAnotherKeyPair().getPrivate(), JwtTestKeys.ACTIVE_KEY_ID);

        assertThatThrownBy(() -> accessTokenProvider.parseUserId(forgedToken))
                .isInstanceOf(BusinessException.class)
                .hasMessageNotContaining(forgedToken);
    }

    private String signWithRsa(PrivateKey privateKey, String keyId) {
        return signWithRsa(privateKey, keyId, ISSUER, AUDIENCE, TokenCategory.ACCESS.claimValue());
    }

    private String signWithRsa(
            PrivateKey privateKey,
            String keyId,
            String issuer,
            String audience,
            String category
    ) {
        return Jwts.builder()
                .header()
                .keyId(keyId)
                .and()
                .issuer(issuer)
                .audience()
                .add(audience)
                .and()
                .subject(String.valueOf(USER_ID))
                .claim("category", category)
                .expiration(Date.from(Instant.now().plus(ACCESS_TOKEN_TTL)))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }

    private void assertAuthenticationFailed(ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.AUTHENTICATION_FAILED);
    }
}
