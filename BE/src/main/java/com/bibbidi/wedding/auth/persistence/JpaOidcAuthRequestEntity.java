package com.bibbidi.wedding.auth.persistence;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.auth.domain.SocialAuthPurpose;
import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * 인가 URL을 내줄 때 서버가 만든 값을 담아 둔다.
 * 돌아온 요청이 우리가 시작한 그 요청인지 확인하는 데 쓰고, 한 번 쓰면 다시 쓰지 못한다.
 */
@Entity
@Table(name = "oidc_auth_requests")
public class JpaOidcAuthRequestEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "state_hash", nullable = false, length = 64)
    private String stateHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    private SocialProvider provider;

    @Column(name = "nonce", nullable = false)
    private String nonce;

    @Column(name = "code_verifier", nullable = false)
    private String codeVerifier;

    @Column(name = "browser_binder_hash", length = 64)
    private String browserBinderHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "client_type", nullable = false, length = 10)
    private ClientType clientType;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, length = 20)
    private SocialAuthPurpose purpose;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    protected JpaOidcAuthRequestEntity() {
    }

    public JpaOidcAuthRequestEntity(
            Long id,
            String stateHash,
            SocialProvider provider,
            String nonce,
            String codeVerifier,
            String browserBinderHash,
            ClientType clientType,
            SocialAuthPurpose purpose,
            LocalDateTime expiresAt,
            LocalDateTime usedAt
    ) {
        this.id = id;
        this.stateHash = stateHash;
        this.provider = provider;
        this.nonce = nonce;
        this.codeVerifier = codeVerifier;
        this.browserBinderHash = browserBinderHash;
        this.clientType = clientType;
        this.purpose = purpose;
        this.expiresAt = expiresAt;
        this.usedAt = usedAt;
    }

    public Long id() {
        return id;
    }

    public String stateHash() {
        return stateHash;
    }

    public SocialProvider provider() {
        return provider;
    }

    public String nonce() {
        return nonce;
    }

    public String codeVerifier() {
        return codeVerifier;
    }

    public String browserBinderHash() {
        return browserBinderHash;
    }

    public ClientType clientType() {
        return clientType;
    }

    public SocialAuthPurpose purpose() {
        return purpose;
    }

    public LocalDateTime expiresAt() {
        return expiresAt;
    }

    public LocalDateTime usedAt() {
        return usedAt;
    }
}
