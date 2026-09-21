package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.token.AccessTokenProvider;
import com.bibbidi.wedding.auth.token.JwtProperties;
import com.bibbidi.wedding.auth.token.RefreshTokenGenerator;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserService;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JwtService {

    private final AuthService authService;
    private final AccessTokenProvider accessTokenProvider;
    private final RefreshTokenGenerator refreshTokenGenerator;
    private final RefreshSessionRepository refreshSessionRepository;
    private final JwtProperties jwtProperties;
    private final UserService userService;

    public JwtService(
            AuthService authService,
            AccessTokenProvider accessTokenProvider,
            RefreshTokenGenerator refreshTokenGenerator,
            RefreshSessionRepository refreshSessionRepository,
            JwtProperties jwtProperties,
            UserService userService
    ) {
        this.authService = authService;
        this.accessTokenProvider = accessTokenProvider;
        this.refreshTokenGenerator = refreshTokenGenerator;
        this.refreshSessionRepository = refreshSessionRepository;
        this.jwtProperties = jwtProperties;
        this.userService = userService;
    }

    @Transactional
    public IssuedTokens issueTokens(String nickname, String rawPassword) {
        AuthResult authenticatedUser = authService.login(nickname, rawPassword);
        return issueTokensFor(authenticatedUser.userId());
    }

    @Transactional
    public IssuedTokens reissueTokens(String refreshToken) {
        String tokenHash = refreshTokenGenerator.hash(refreshToken);
        Long userId = findSessionOwnerId(tokenHash);
        validateSessionOwnerExists(userId);
        consumeSession(tokenHash);
        return issueTokensFor(userId);
    }

    @Transactional
    public void discardSession(String refreshToken) {
        String tokenHash = refreshTokenGenerator.hash(refreshToken);
        refreshSessionRepository.revokeUsableSession(tokenHash, LocalDateTime.now());
    }

    private IssuedTokens issueTokensFor(Long userId) {
        LocalDateTime issuedAt = LocalDateTime.now();
        String accessToken = accessTokenProvider.issue(userId, issuedAt.atZone(ZoneId.systemDefault()).toInstant());

        String refreshToken = refreshTokenGenerator.generate();
        LocalDateTime refreshTokenExpiresAt = issuedAt.plus(jwtProperties.refreshTokenTtl());
        refreshSessionRepository.save(userId, refreshTokenGenerator.hash(refreshToken), refreshTokenExpiresAt);

        return new IssuedTokens(accessToken, refreshToken, jwtProperties.refreshTokenTtl());
    }

    private Long findSessionOwnerId(String tokenHash) {
        return refreshSessionRepository.findUserIdByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException(
                        ClientError.AUTHENTICATION_FAILED, "토큰 재발급 실패: 저장된 Refresh 세션이 없습니다."));
    }

    private void validateSessionOwnerExists(Long userId) {
        if (!userService.existsById(userId)) {
            throw new BusinessException(
                    ClientError.AUTHENTICATION_FAILED, "토큰 재발급 실패: 사용자 계정이 없습니다.");
        }
    }

    private void consumeSession(String tokenHash) {
        if (!refreshSessionRepository.revokeUsableSession(tokenHash, LocalDateTime.now())) {
            throw new BusinessException(
                    ClientError.AUTHENTICATION_FAILED, "토큰 재발급 실패: 이미 폐기됐거나 만료된 Refresh 세션입니다.");
        }
    }
}
