package com.bibbidi.wedding.auth.domain;

import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;

/**
 * 살아 있는 refresh token 하나다.
 * 같은 기기에서 갱신을 이어 가면 familyId를 그대로 물려받는다.
 */
public record RefreshSession(
        @Nullable Long id,
        Long userId,
        String familyId,
        ClientType clientType,
        String tokenHash,
        LocalDateTime expiresAt,
        @Nullable LocalDateTime revokedAt,
        @Nullable LocalDateTime rotatedAt
) {

    public static RefreshSession issue(
            Long userId,
            String familyId,
            ClientType clientType,
            String tokenHash,
            LocalDateTime expiresAt
    ) {
        return new RefreshSession(null, userId, familyId, clientType, tokenHash, expiresAt, null, null);
    }

    public boolean isUsable(LocalDateTime now) {
        return revokedAt == null && rotatedAt == null && expiresAt.isAfter(now);
    }

    /** 이미 한 번 바꿔 쓴 토큰이 다시 들어왔다는 뜻이다. 훔쳐 쓰였을 수 있다. */
    public boolean isReused(LocalDateTime now) {
        return rotatedAt != null || revokedAt != null || !expiresAt.isAfter(now);
    }

    public RefreshSession rotate(LocalDateTime rotatedAt) {
        return new RefreshSession(id, userId, familyId, clientType, tokenHash, expiresAt, revokedAt, rotatedAt);
    }

    public RefreshSession revoke(LocalDateTime revokedAt) {
        return new RefreshSession(id, userId, familyId, clientType, tokenHash, expiresAt, revokedAt, rotatedAt);
    }
}
