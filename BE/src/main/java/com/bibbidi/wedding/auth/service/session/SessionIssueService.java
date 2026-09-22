package com.bibbidi.wedding.auth.service.session;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.auth.token.OpaqueTokenGenerator;
import com.bibbidi.wedding.auth.token.SessionProperties;
import com.bibbidi.wedding.common.domain.UserStatus;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인한 사용자에게 access token과 refresh token을 내준다.
 * 새 기기에서 시작하면 기기 계열을 새로 만들고, 이어지는 갱신은 그 계열을 물려받는다.
 */
@Service
@Transactional
public class SessionIssueService {

    private final BibbidiTokenIssuer bibbidiTokenIssuer;
    private final OpaqueTokenGenerator opaqueTokenGenerator;
    private final RefreshSessionRepository refreshSessionRepository;
    private final SessionProperties sessionProperties;

    public SessionIssueService(
            BibbidiTokenIssuer bibbidiTokenIssuer,
            OpaqueTokenGenerator opaqueTokenGenerator,
            RefreshSessionRepository refreshSessionRepository,
            SessionProperties sessionProperties
    ) {
        this.bibbidiTokenIssuer = bibbidiTokenIssuer;
        this.opaqueTokenGenerator = opaqueTokenGenerator;
        this.refreshSessionRepository = refreshSessionRepository;
        this.sessionProperties = sessionProperties;
    }

    public IssuedSession issueForNewFamily(SessionOwner owner, ClientType clientType) {
        return issue(owner, clientType, UUID.randomUUID().toString());
    }

    public IssuedSession issue(SessionOwner owner, ClientType clientType, String familyId) {
        String refreshToken = opaqueTokenGenerator.generate();
        refreshSessionRepository.save(RefreshSession.issue(
                owner.userId(),
                familyId,
                clientType,
                opaqueTokenGenerator.hash(refreshToken),
                LocalDateTime.now().plus(sessionProperties.refreshTokenTtl())));

        String accessToken = bibbidiTokenIssuer.issueAccessToken(new BibbidiTokenClaims(
                owner.userId(), owner.status(), owner.role(), owner.nickname(), owner.email()));

        return new IssuedSession(
                accessToken,
                refreshToken,
                clientType,
                familyId,
                owner.status() == UserStatus.PENDING);
    }
}
