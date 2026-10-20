package com.bibbidi.wedding.auth.domain;

import java.time.LocalDateTime;
import org.jspecify.annotations.Nullable;

/** 네이티브 로그인을 WebView로 넘기는 1회용 코드다. */
public record HandoffCode(
        @Nullable Long id,
        String codeHash,
        Long userId,
        String familyId,
        LocalDateTime expiresAt,
        @Nullable LocalDateTime usedAt
) {

    public static HandoffCode issue(String codeHash, Long userId, String familyId, LocalDateTime expiresAt) {
        return new HandoffCode(null, codeHash, userId, familyId, expiresAt, null);
    }

    public boolean isUsable(LocalDateTime now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    public HandoffCode use(LocalDateTime usedAt) {
        return new HandoffCode(id, codeHash, userId, familyId, expiresAt, usedAt);
    }
}
