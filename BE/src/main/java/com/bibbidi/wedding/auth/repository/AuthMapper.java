package com.bibbidi.wedding.auth.repository;

import com.bibbidi.wedding.auth.domain.HandoffCode;
import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.domain.RefreshSession;
import com.bibbidi.wedding.auth.domain.SocialIdentity;
import com.bibbidi.wedding.auth.persistence.JpaHandoffCodeEntity;
import com.bibbidi.wedding.auth.persistence.JpaOidcAuthRequestEntity;
import com.bibbidi.wedding.auth.persistence.JpaRefreshSessionEntity;
import com.bibbidi.wedding.auth.persistence.JpaSocialIdentityEntity;
import org.springframework.stereotype.Component;

@Component
public class AuthMapper {

    public JpaRefreshSessionEntity toEntity(RefreshSession session) {
        return new JpaRefreshSessionEntity(
                session.id(),
                session.userId(),
                session.familyId(),
                session.clientType(),
                session.tokenHash(),
                session.expiresAt(),
                session.revokedAt(),
                session.rotatedAt());
    }

    public RefreshSession toDomain(JpaRefreshSessionEntity entity) {
        return new RefreshSession(
                entity.id(),
                entity.userId(),
                entity.familyId(),
                entity.clientType(),
                entity.tokenHash(),
                entity.expiresAt(),
                entity.revokedAt(),
                entity.rotatedAt());
    }

    public JpaOidcAuthRequestEntity toEntity(OidcAuthRequest request) {
        return new JpaOidcAuthRequestEntity(
                request.id(),
                request.stateHash(),
                request.provider(),
                request.nonce(),
                request.codeVerifier(),
                request.browserBinderHash(),
                request.clientType(),
                request.purpose(),
                request.expiresAt(),
                request.usedAt());
    }

    public OidcAuthRequest toDomain(JpaOidcAuthRequestEntity entity) {
        return new OidcAuthRequest(
                entity.id(),
                entity.stateHash(),
                entity.provider(),
                entity.nonce(),
                entity.codeVerifier(),
                entity.browserBinderHash(),
                entity.clientType(),
                entity.purpose(),
                entity.expiresAt(),
                entity.usedAt());
    }

    public JpaHandoffCodeEntity toEntity(HandoffCode code) {
        return new JpaHandoffCodeEntity(
                code.id(),
                code.codeHash(),
                code.userId(),
                code.familyId(),
                code.expiresAt(),
                code.usedAt());
    }

    public HandoffCode toDomain(JpaHandoffCodeEntity entity) {
        return new HandoffCode(
                entity.id(),
                entity.codeHash(),
                entity.userId(),
                entity.familyId(),
                entity.expiresAt(),
                entity.usedAt());
    }

    public JpaSocialIdentityEntity toEntity(SocialIdentity identity) {
        return new JpaSocialIdentityEntity(
                identity.id(),
                identity.userId(),
                identity.provider(),
                identity.providerUserId());
    }

    public SocialIdentity toDomain(JpaSocialIdentityEntity entity) {
        return new SocialIdentity(
                entity.id(),
                entity.userId(),
                entity.provider(),
                entity.providerUserId());
    }
}
