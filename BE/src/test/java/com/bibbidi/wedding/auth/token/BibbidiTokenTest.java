package com.bibbidi.wedding.auth.token;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BibbidiTokenTest {

    private static final String SECRET = "test-only-jwt-secret-value-for-bibbidi-auth";
    private static final String ISSUER = "bibbidi-test";
    private static final String AUDIENCE = "bibbidi-test-client";

    private static final BibbidiTokenClaims CLAIMS =
            new BibbidiTokenClaims(1L, UserStatus.ACTIVE, UserRole.NORMAL, "current", "current@bibbidi.kr");

    @Test
    @DisplayName("발급한 access token에서 사용자와 표시용 정보를 그대로 꺼낸다")
    void shouldIssueAndParseAccessToken() {
        JwtProperties properties = properties(Duration.ofMinutes(30));
        BibbidiTokenIssuer issuer = issuer(properties);

        BibbidiTokenClaims parsed = parser(properties).parseAccessToken(issuer.issueAccessToken(CLAIMS));

        assertThat(parsed).isEqualTo(CLAIMS);
    }

    @Test
    @DisplayName("만료된 access token은 만료 오류로 거절한다")
    void shouldRejectExpiredAccessToken() {
        JwtProperties properties = properties(Duration.ofSeconds(-1));
        String expired = issuer(properties).issueAccessToken(CLAIMS);

        assertThatThrownBy(() -> parser(properties).parseAccessToken(expired))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.ACCESS_TOKEN_EXPIRED);
    }

    @Test
    @DisplayName("다른 비밀말로 서명한 token은 거절한다")
    void shouldRejectTokenSignedWithOtherSecret() {
        String forged = issuer(properties(Duration.ofMinutes(30), SECRET + "-other", ISSUER, AUDIENCE))
                .issueAccessToken(CLAIMS);

        assertThatThrownBy(() -> parser(properties(Duration.ofMinutes(30))).parseAccessToken(forged))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.ACCESS_TOKEN_INVALID);
    }

    @Test
    @DisplayName("발급자나 대상이 다른 token은 거절한다")
    void shouldRejectTokenWithOtherIssuerOrAudience() {
        String otherIssuer = issuer(properties(Duration.ofMinutes(30), SECRET, "other", AUDIENCE))
                .issueAccessToken(CLAIMS);
        String otherAudience = issuer(properties(Duration.ofMinutes(30), SECRET, ISSUER, "other"))
                .issueAccessToken(CLAIMS);
        BibbidiTokenParser parser = parser(properties(Duration.ofMinutes(30)));

        assertThatThrownBy(() -> parser.parseAccessToken(otherIssuer))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> parser.parseAccessToken(otherAudience))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("탈퇴용 표를 access token 자리에 넣으면 용도가 다르다고 거절한다")
    void shouldRejectDeleteGrantUsedAsAccessToken() {
        JwtProperties properties = properties(Duration.ofMinutes(30));
        String deleteGrant = issuer(properties).issueDeleteGrant(1L);

        assertThatThrownBy(() -> parser(properties).parseAccessToken(deleteGrant))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.ACCESS_TOKEN_INVALID);
    }

    @Test
    @DisplayName("탈퇴용 표에서 대상 회원을 꺼낸다")
    void shouldParseDeleteGrant() {
        JwtProperties properties = properties(Duration.ofMinutes(30));

        Long userId = parser(properties).parseDeleteGrant(issuer(properties).issueDeleteGrant(7L));

        assertThat(userId).isEqualTo(7L);
    }

    @Test
    @DisplayName("access token을 탈퇴용 표 자리에 넣으면 거절한다")
    void shouldRejectAccessTokenUsedAsDeleteGrant() {
        JwtProperties properties = properties(Duration.ofMinutes(30));
        String accessToken = issuer(properties).issueAccessToken(CLAIMS);

        assertThatThrownBy(() -> parser(properties).parseDeleteGrant(accessToken))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DELETE_GRANT_INVALID);
    }

    @Test
    @DisplayName("비밀말이 비었거나 너무 짧으면 애플리케이션을 띄우지 않는다")
    void shouldRejectWeakSecret() {
        assertThatThrownBy(() -> new JwtSigningKeySource(
                properties(Duration.ofMinutes(30), "", ISSUER, AUDIENCE)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new JwtSigningKeySource(
                properties(Duration.ofMinutes(30), "too-short", ISSUER, AUDIENCE)))
                .isInstanceOf(IllegalStateException.class);
    }

    private static JwtProperties properties(Duration accessTokenTtl) {
        return properties(accessTokenTtl, SECRET, ISSUER, AUDIENCE);
    }

    private static JwtProperties properties(
            Duration accessTokenTtl, String secret, String issuer, String audience) {
        return new JwtProperties(
                secret, issuer, audience, accessTokenTtl, Duration.ofMinutes(5), "Authorization");
    }

    private static BibbidiTokenIssuer issuer(JwtProperties properties) {
        return new BibbidiTokenIssuer(properties, new JwtSigningKeySource(properties));
    }

    private static BibbidiTokenParser parser(JwtProperties properties) {
        return new BibbidiTokenParser(properties, new JwtSigningKeySource(properties));
    }
}
