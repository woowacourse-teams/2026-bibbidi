package com.bibbidi.wedding.auth.persistence;

import com.bibbidi.wedding.auth.domain.SocialProvider;
import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "social_identities")
public class JpaSocialIdentityEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    private SocialProvider provider;

    @Column(name = "provider_user_id", nullable = false)
    private String providerUserId;

    protected JpaSocialIdentityEntity() {
    }

    public JpaSocialIdentityEntity(Long id, Long userId, SocialProvider provider, String providerUserId) {
        this.id = id;
        this.userId = userId;
        this.provider = provider;
        this.providerUserId = providerUserId;
    }

    public Long id() {
        return id;
    }

    public Long userId() {
        return userId;
    }

    public SocialProvider provider() {
        return provider;
    }

    public String providerUserId() {
        return providerUserId;
    }
}
