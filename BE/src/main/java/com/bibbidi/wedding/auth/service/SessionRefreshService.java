package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.auth.token.BibbidiTokenParser;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@Transactional
public class SessionRefreshService {

    private final RefreshSessionRepository refreshSessionRepository;
    private final BibbidiTokenParser bibbidiTokenParser;
    private final SessionIssueService sessionIssueService;
    private final UserService userService;

    public SessionRefreshService(
            RefreshSessionRepository refreshSessionRepository,
            BibbidiTokenParser bibbidiTokenParser,
            SessionIssueService sessionIssueService,
            UserService userService
    ) {
        this.refreshSessionRepository = refreshSessionRepository;
        this.bibbidiTokenParser = bibbidiTokenParser;
        this.sessionIssueService = sessionIssueService;
        this.userService = userService;
    }

    public IssuedSession refresh(String refreshToken, ClientType clientType) {
        LocalDateTime now = LocalDateTime.now();
        RefreshSession session = findSession(refreshToken);

        if (session.isReused(now)) {
            revokeFamilyAfterReuse(session, now);
        }
        if (session.clientType() != clientType) {
            throw new BusinessException(ClientError.REFRESH_SESSION_INVALID,
                    "발급할 때와 다른 클라이언트 종류로 갱신을 시도했습니다. sessionId=" + session.id());
        }

        refreshSessionRepository.save(session.rotate(now));
        return sessionIssueService.issue(userAuthInfo(session.userId()), clientType, session.familyId());
    }

    public void revokeSession(String refreshToken) {
        RefreshSession session = findSession(refreshToken);
        refreshSessionRepository.revokeFamily(session.familyId(), LocalDateTime.now());
    }

    private RefreshSession findSession(String refreshToken) {
        return refreshSessionRepository.findByTokenHash(bibbidiTokenParser.hashRefreshToken(refreshToken))
                .orElseThrow(() -> new BusinessException(ClientError.REFRESH_SESSION_INVALID,
                        "저장된 refresh 세션을 찾지 못했습니다."));
    }

    private void revokeFamilyAfterReuse(RefreshSession session, LocalDateTime now) {
        int revoked = refreshSessionRepository.revokeFamily(session.familyId(), now);
        log.warn("이미 사용한 refresh token이 다시 들어와 기기 계열을 폐기했습니다. familyId={} 폐기수={}",
                session.familyId(), revoked);
        throw new BusinessException(ClientError.REFRESH_SESSION_INVALID,
                "이미 사용했거나 만료된 refresh token입니다. familyId=" + session.familyId());
    }

    private UserAuthInfo userAuthInfo(Long userId) {
        UserResult user = userService.findCurrentUserInfo(userId);
        return new UserAuthInfo(user.id(), user.status(), user.role(), user.nickname(), user.email());
    }
}
