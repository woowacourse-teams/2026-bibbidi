package com.bibbidi.wedding.auth.service.handoff;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.HandoffCode;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.repository.HandoffCodeRepository;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
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
 * 네이티브에서 한 로그인을 앱 안 WebView로 넘긴다.
 *
 * <p>앱이 받은 refresh token을 그대로 넘기지 않고, 수명이 짧은 1회용 코드만 건넨다.
 * 코드를 받은 웹 세션은 앱 세션과 같은 기기 계열에 들어가, 앱 쪽에서 토큰 재사용이 감지되면 함께 끊긴다.
 */
@Service
@Transactional
public class HandoffService {

    private final HandoffCodeRepository handoffCodeRepository;
    private final RefreshSessionRepository refreshSessionRepository;
    private final OpaqueTokenGenerator opaqueTokenGenerator;
    private final SessionIssueService sessionIssueService;
    private final UserService userService;
    private final SessionProperties sessionProperties;

    public HandoffService(
            HandoffCodeRepository handoffCodeRepository,
            RefreshSessionRepository refreshSessionRepository,
            OpaqueTokenGenerator opaqueTokenGenerator,
            SessionIssueService sessionIssueService,
            UserService userService,
            SessionProperties sessionProperties
    ) {
        this.handoffCodeRepository = handoffCodeRepository;
        this.refreshSessionRepository = refreshSessionRepository;
        this.opaqueTokenGenerator = opaqueTokenGenerator;
        this.sessionIssueService = sessionIssueService;
        this.userService = userService;
        this.sessionProperties = sessionProperties;
    }

    /**
     * 앱이 자기 refresh token을 내밀면 그 기기 계열에 묶인 코드를 내준다.
     * 코드로 만들어질 웹 세션이 앱 세션과 같은 계열에 들어가야 함께 폐기되기 때문이다.
     */
    public String issueCode(Long currentUserId, String refreshToken) {
        LocalDateTime now = LocalDateTime.now();
        RefreshSession session = refreshSessionRepository
                .findByTokenHash(opaqueTokenGenerator.hash(refreshToken))
                .orElseThrow(() -> new BusinessException(ClientError.REFRESH_SESSION_INVALID,
                        "저장된 refresh 세션을 찾지 못했습니다."));

        if (!session.isUsable(now) || !session.userId().equals(currentUserId)) {
            throw new BusinessException(ClientError.REFRESH_SESSION_INVALID,
                    "쓸 수 없거나 다른 회원의 refresh 세션입니다. sessionId=" + session.id());
        }

        String code = opaqueTokenGenerator.generate();
        handoffCodeRepository.save(HandoffCode.issue(
                opaqueTokenGenerator.hash(code),
                session.userId(),
                session.familyId(),
                now.plus(sessionProperties.handoffCodeTtl())));
        return code;
    }

    public IssuedSession exchange(String code) {
        LocalDateTime now = LocalDateTime.now();
        HandoffCode handoffCode = handoffCodeRepository
                .findByCodeHash(opaqueTokenGenerator.hash(code))
                .orElseThrow(() -> new BusinessException(ClientError.HANDOFF_CODE_INVALID,
                        "서버가 만든 적 없는 handoff code입니다."));

        if (!handoffCode.isUsable(now)) {
            throw new BusinessException(ClientError.HANDOFF_CODE_INVALID,
                    "이미 썼거나 만료된 handoff code입니다. codeId=" + handoffCode.id());
        }

        handoffCodeRepository.save(handoffCode.use(now));

        UserResult user = userService.findCurrentUserInfo(handoffCode.userId());
        SessionOwner owner = new SessionOwner(user.id(), user.status(), user.role(), user.nickname(), user.email());
        return sessionIssueService.issue(owner, ClientType.WEB, handoffCode.familyId());
    }
}
