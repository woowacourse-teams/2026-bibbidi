package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.HandoffCode;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.repository.HandoffCodeRepository;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.token.SecretValueGenerator;
import com.bibbidi.wedding.auth.config.SessionProperties;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class HandoffService {

    private final HandoffCodeRepository handoffCodeRepository;
    private final RefreshSessionRepository refreshSessionRepository;
    private final SecretValueGenerator secretValueGenerator;
    private final SessionIssueService sessionIssueService;
    private final UserService userService;
    private final SessionProperties sessionProperties;

    public HandoffService(
            HandoffCodeRepository handoffCodeRepository,
            RefreshSessionRepository refreshSessionRepository,
            SecretValueGenerator secretValueGenerator,
            SessionIssueService sessionIssueService,
            UserService userService,
            SessionProperties sessionProperties
    ) {
        this.handoffCodeRepository = handoffCodeRepository;
        this.refreshSessionRepository = refreshSessionRepository;
        this.secretValueGenerator = secretValueGenerator;
        this.sessionIssueService = sessionIssueService;
        this.userService = userService;
        this.sessionProperties = sessionProperties;
    }

    public String issueCode(Long currentUserId) {
        LocalDateTime now = LocalDateTime.now();
        RefreshSession session = refreshSessionRepository
                .findLatestUsableNativeSession(currentUserId, now)
                .orElseThrow(() -> new BusinessException(ClientError.REFRESH_SESSION_INVALID,
                        "저장된 refresh 세션을 찾지 못했습니다."));

        String code = secretValueGenerator.generate();
        handoffCodeRepository.save(
                HandoffCode.issue(
                        secretValueGenerator.toSha256Hex(code),
                        session.userId(),
                        session.familyId(),
                        now.plus(sessionProperties.handoffCodeLifetime())
                )
        );
        return code;
    }

    public IssuedSession exchange(String code) {
        LocalDateTime now = LocalDateTime.now();
        HandoffCode handoffCode = handoffCodeRepository
                .findByCodeHash(secretValueGenerator.toSha256Hex(code))
                .orElseThrow(() -> new BusinessException(ClientError.HANDOFF_CODE_INVALID,
                        "서버가 만든 적 없는 handoff code입니다."));

        if (!handoffCode.isUsable(now)) {
            throw new BusinessException(ClientError.HANDOFF_CODE_INVALID,
                    "이미 썼거나 만료된 handoff code입니다. codeId=" + handoffCode.id());
        }

        if (!refreshSessionRepository.hasUsableFamily(handoffCode.familyId(), now)) {
            throw new BusinessException(
                    ClientError.HANDOFF_CODE_INVALID,
                    "handoff code를 발급한 세션 계열이 폐기되었습니다. familyId="
                            + handoffCode.familyId());
        }

        handoffCodeRepository.save(handoffCode.use(now));

        UserResult user = userService.findCurrentUserInfo(handoffCode.userId());
        UserAuthInfo userAuthInfo = new UserAuthInfo(
                user.id(),
                user.status(),
                user.role(),
                user.nickname(),
                user.email()
        );
        return sessionIssueService.issue(userAuthInfo, ClientType.WEB, handoffCode.familyId());
    }
}
