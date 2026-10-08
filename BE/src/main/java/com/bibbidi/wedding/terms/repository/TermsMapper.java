package com.bibbidi.wedding.terms.repository;

import com.bibbidi.wedding.terms.domain.Terms;
import com.bibbidi.wedding.terms.domain.TermsAgreement;
import com.bibbidi.wedding.terms.persistence.JpaTermsAgreementEntity;
import com.bibbidi.wedding.terms.persistence.JpaTermsEntity;
import org.springframework.stereotype.Component;

@Component
public class TermsMapper {

    public Terms toDomain(JpaTermsEntity entity) {
        return new Terms(
                entity.id(),
                entity.code(),
                entity.version(),
                entity.title(),
                entity.content(),
                entity.required());
    }

    public JpaTermsAgreementEntity toEntity(TermsAgreement agreement) {
        return new JpaTermsAgreementEntity(
                agreement.id(),
                agreement.userId(),
                agreement.termsId(),
                agreement.agreedAt());
    }

    public TermsAgreement toDomain(JpaTermsAgreementEntity entity) {
        return new TermsAgreement(entity.id(), entity.userId(), entity.termsId(), entity.agreedAt());
    }
}
