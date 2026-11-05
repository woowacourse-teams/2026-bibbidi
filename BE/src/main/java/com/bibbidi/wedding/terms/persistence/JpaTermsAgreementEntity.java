package com.bibbidi.wedding.terms.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "terms_agreements")
public class JpaTermsAgreementEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "terms_id", nullable = false)
    private Long termsId;

    @Column(name = "agreed_at", nullable = false)
    private LocalDateTime agreedAt;

    protected JpaTermsAgreementEntity() {
    }

    public JpaTermsAgreementEntity(Long id, Long userId, Long termsId, LocalDateTime agreedAt) {
        this.id = id;
        this.userId = userId;
        this.termsId = termsId;
        this.agreedAt = agreedAt;
    }

    public Long id() {
        return id;
    }

    public Long userId() {
        return userId;
    }

    public Long termsId() {
        return termsId;
    }

    public LocalDateTime agreedAt() {
        return agreedAt;
    }
}
