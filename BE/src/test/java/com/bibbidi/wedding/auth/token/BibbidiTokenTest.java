package com.bibbidi.wedding.auth.token;

import com.bibbidi.wedding.auth.config.BibbidiTokenProperties;
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
        BibbidiTokenProperties properties = properties(Duration.ofMinutes(30));
        BibbidiTokenIssuer issuer = issuer(properties);

        BibbidiTokenClaims parsed = parser(properties).parseAccessToken(issuer.issueAccessToken(CLAIMS));

        assertThat(parsed).isEqualTo(CLAIMS);
    }

    @Test
    @DisplayName("만료된 access token은 만료 오류로 거절한다")
    void shouldRejectExpiredAccessToken() {
        BibbidiTokenProperties properties = properties(Duration.ofSeconds(-1));
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
        BibbidiTokenProperties properties = properties(Duration.ofMinutes(30));
        String deleteGrant = issuer(properties).issueDeleteGrantToken(1L);

        assertThatThrownBy(() -> parser(properties).parseAccessToken(deleteGrant))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.ACCESS_TOKEN_INVALID);
    }

    @Test
    @DisplayName("탈퇴용 표에서 대상 회원을 꺼낸다")
    void shouldParseDeleteGrant() {
        BibbidiTokenProperties properties = properties(Duration.ofMinutes(30));

        Long userId = parser(properties).parseDeleteGrantToken(issuer(properties).issueDeleteGrantToken(7L));

        assertThat(userId).isEqualTo(7L);
    }

    @Test
    @DisplayName("access token을 탈퇴용 표 자리에 넣으면 거절한다")
    void shouldRejectAccessTokenUsedAsDeleteGrant() {
        BibbidiTokenProperties properties = properties(Duration.ofMinutes(30));
        String accessToken = issuer(properties).issueAccessToken(CLAIMS);

        assertThatThrownBy(() -> parser(properties).parseDeleteGrantToken(accessToken))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DELETE_GRANT_INVALID);
    }

    @Test
    @DisplayName("refresh token은 뜻을 담지 않는 값과 저장용 해시를 함께 준다")
    void shouldIssueRefreshTokenWithHash() {
        IssuedRefreshToken refreshToken = issuer(properties(Duration.ofMinutes(30))).issueRefreshToken();

        assertThat(refreshToken.value()).isNotBlank();
        assertThat(refreshToken.hash())
                .isNotBlank()
                .isNotEqualTo(refreshToken.value())
                .isEqualTo(new SecretValueGenerator().toSha256Hex(refreshToken.value()));
    }

    @Test
    @DisplayName("발급할 때 쓴 해시와 읽을 때 쓰는 해시가 같다")
    void shouldHashRefreshTokenSameWayOnIssueAndLookup() {
        BibbidiTokenProperties properties = properties(Duration.ofMinutes(30));
        IssuedRefreshToken issued = issuer(properties).issueRefreshToken();

        assertThat(parser(properties).hashRefreshToken(issued.value())).isEqualTo(issued.hash());
    }

    @Test
    @DisplayName("refresh token은 발급할 때마다 다른 값이다")
    void shouldIssueDifferentRefreshTokenEachTime() {
        BibbidiTokenIssuer issuer = issuer(properties(Duration.ofMinutes(30)));

        assertThat(issuer.issueRefreshToken().value())
                .isNotEqualTo(issuer.issueRefreshToken().value());
    }

    @Test
    @DisplayName("비밀말이 비었거나 너무 짧으면 애플리케이션을 띄우지 않는다")
    void shouldRejectWeakSecret() {
        assertThatThrownBy(() -> new BibbidiTokenSigningKey(
                properties(Duration.ofMinutes(30), "", ISSUER, AUDIENCE)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new BibbidiTokenSigningKey(
                properties(Duration.ofMinutes(30), "too-short", ISSUER, AUDIENCE)))
                .isInstanceOf(IllegalStateException.class);
    }

    private static BibbidiTokenProperties properties(Duration accessTokenLifetime) {
        return properties(accessTokenLifetime, SECRET, ISSUER, AUDIENCE);
    }

    private static BibbidiTokenProperties properties(
            Duration accessTokenLifetime, String secret, String issuer, String audience) {
        return new BibbidiTokenProperties(
                secret, issuer, audience, accessTokenLifetime, Duration.ofMinutes(5), "Authorization");
    }

    private static BibbidiTokenIssuer issuer(BibbidiTokenProperties properties) {
        return new BibbidiTokenIssuer(
                properties, new BibbidiTokenSigningKey(properties), new SecretValueGenerator());
    }

    private static BibbidiTokenParser parser(BibbidiTokenProperties properties) {
        return new BibbidiTokenParser(
                properties, new BibbidiTokenSigningKey(properties), new SecretValueGenerator());
    }
}
