package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.repository.RefreshSessionRepository;
import com.bibbidi.wedding.auth.token.BibbidiTokenClaims;
import com.bibbidi.wedding.auth.token.BibbidiTokenIssuer;
import com.bibbidi.wedding.auth.token.IssuedRefreshToken;
import com.bibbidi.wedding.auth.config.SessionProperties;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.common.domain.UserStatus;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SessionIssueService {

    private final BibbidiTokenIssuer bibbidiTokenIssuer;
    private final RefreshSessionRepository refreshSessionRepository;
    private final SessionProperties sessionProperties;

    public SessionIssueService(
            BibbidiTokenIssuer bibbidiTokenIssuer,
            RefreshSessionRepository refreshSessionRepository,
            SessionProperties sessionProperties
    ) {
        this.bibbidiTokenIssuer = bibbidiTokenIssuer;
        this.refreshSessionRepository = refreshSessionRepository;
        this.sessionProperties = sessionProperties;
    }

    public IssuedSession issueForNewFamily(UserAuthInfo user, ClientType clientType) {
        return issue(user, clientType, UUID.randomUUID().toString());
    }

    public IssuedSession issue(UserAuthInfo user, ClientType clientType, String familyId) {
        IssuedRefreshToken refreshToken = bibbidiTokenIssuer.issueRefreshToken();
        refreshSessionRepository.save(
                RefreshSession.issue(
                        user.userId(),
                        familyId,
                        clientType,
                        refreshToken.hash(),
                        LocalDateTime.now().plus(sessionProperties.refreshTokenLifetime())
                )
        );

        String accessToken = bibbidiTokenIssuer.issueAccessToken(
                new BibbidiTokenClaims(
                        user.userId(),
                        user.status(),
                        user.role(),
                        user.nickname(),
                        user.email()
                )
        );

        return new IssuedSession(
                accessToken,
                refreshToken.value(),
                clientType,
                familyId,
                user.status() == UserStatus.PENDING
        );
    }
}
