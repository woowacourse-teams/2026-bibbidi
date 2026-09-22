package com.bibbidi.wedding.auth.service.session;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.token.OpaqueTokenGenerator;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * refresh token으로 새 한 쌍을 내준다.
 *
 * <p>쓴 토큰은 그 자리에서 못 쓰게 만든다. 이미 쓴 토큰이 다시 들어오면 훔쳐 쓰였다고 보고
 * 그 기기 계열에 딸린 세션을 모두 폐기한다. 앱에서 넘어간 WebView 세션도 같은 계열이라 함께 끊긴다.
 */
@Slf4j
@Service
@Transactional
public class SessionRefreshService {

    private final RefreshSessionRepository refreshSessionRepository;
    private final OpaqueTokenGenerator opaqueTokenGenerator;
    private final SessionIssueService sessionIssueService;
    private final UserService userService;

    public SessionRefreshService(
            RefreshSessionRepository refreshSessionRepository,
            OpaqueTokenGenerator opaqueTokenGenerator,
            SessionIssueService sessionIssueService,
            UserService userService
    ) {
        this.refreshSessionRepository = refreshSessionRepository;
        this.opaqueTokenGenerator = opaqueTokenGenerator;
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
        return sessionIssueService.issue(owner(session.userId()), clientType, session.familyId());
    }

    /** 로그아웃이다. 그 기기 계열만 끊고 다른 기기는 건드리지 않는다. */
    public void revokeSession(String refreshToken) {
        RefreshSession session = findSession(refreshToken);
        refreshSessionRepository.revokeFamily(session.familyId(), LocalDateTime.now());
    }

    private RefreshSession findSession(String refreshToken) {
        return refreshSessionRepository.findByTokenHash(opaqueTokenGenerator.hash(refreshToken))
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

    private SessionOwner owner(Long userId) {
        UserResult user = userService.findCurrentUserInfo(userId);
        return new SessionOwner(user.id(), user.status(), user.role(), user.nickname(), user.email());
    }
}
